import type { Db } from "mongodb";
import { ObjectId } from "mongodb";
import {
  DEFAULT_CAROUSEL_BANNERS,
  DEFAULT_DELIVERY_SETTINGS,
  DEFAULT_OFFERS,
  DEFAULT_STORE_CONFIG,
  type DiscountReward,
  type FreebieReward,
  type Offer,
  type StoreSettingsDocument,
} from "./offerTypes";
import type { CarouselBanner } from "@/app/api/carousel/carouselTypes";
import type { DeliverySettings } from "@/app/api/delivery/deliverySettingsTypes";
import { normalizeDeliverySettings } from "@/app/api/delivery/deliverySettingsUtils";
import { normalizeStoreConfig } from "@/app/api/store/storeConfigUtils";
import type { StoreConfig } from "@/app/api/store/storeConfigTypes";
import {
  STORE_SETTINGS_ID,
  storeSettingsCollection,
} from "./storeSettingsUtils";
import { bumpSyncVersion } from "@/app/api/app/syncVersionsUtils";

export async function getStoreSettings(db: Db): Promise<StoreSettingsDocument> {
  const doc = await storeSettingsCollection(db).findOne({
    _id: STORE_SETTINGS_ID,
  });

  if (!doc) {
    const seeded: StoreSettingsDocument = {
      _id: STORE_SETTINGS_ID,
      offers: DEFAULT_OFFERS,
      carouselBanners: DEFAULT_CAROUSEL_BANNERS,
      deliverySettings: DEFAULT_DELIVERY_SETTINGS,
      storeConfig: DEFAULT_STORE_CONFIG,
      updatedAt: new Date(),
    };
    await storeSettingsCollection(db).updateOne(
      { _id: STORE_SETTINGS_ID },
      { $setOnInsert: seeded },
      { upsert: true },
    );
    return seeded;
  }

  const carouselBanners =
    (doc.carouselBanners as CarouselBanner[] | undefined) ??
    DEFAULT_CAROUSEL_BANNERS;

  if (!doc.carouselBanners?.length) {
    await storeSettingsCollection(db).updateOne(
      { _id: STORE_SETTINGS_ID },
      {
        $set: {
          carouselBanners,
          updatedAt: new Date(),
        },
      },
    );
  }

  return {
    _id: STORE_SETTINGS_ID,
    offers: (doc.offers as Offer[]) ?? [],
    carouselBanners,
    deliverySettings: normalizeDeliverySettings(
      doc.deliverySettings as DeliverySettings | undefined,
    ),
    storeConfig: normalizeStoreConfig(
      doc.storeConfig as StoreConfig | undefined,
    ),
    updatedAt: doc.updatedAt ? new Date(doc.updatedAt) : new Date(),
  };
}

export async function getAllOffers(db: Db): Promise<Offer[]> {
  const settings = await getStoreSettings(db);
  return settings.offers.sort((a, b) => a.sortOrder - b.sortOrder);
}

export async function getEnabledOffers(db: Db): Promise<Offer[]> {
  const offers = await getAllOffers(db);
  return offers.filter((o) => o.enabled);
}

export async function saveOffers(db: Db, offers: Offer[]): Promise<void> {
  await storeSettingsCollection(db).updateOne(
    { _id: STORE_SETTINGS_ID },
    {
      $set: {
        offers,
        updatedAt: new Date(),
      },
      $setOnInsert: { _id: STORE_SETTINGS_ID },
    },
    { upsert: true },
  );
  await bumpSyncVersion(db, "offers");
}

export function normalizeOfferForResponse(offer: Offer): Offer {
  return {
    ...offer,
    minOrderValue: Number(offer.minOrderValue) || 0,
    sortOrder: Number(offer.sortOrder) || 0,
  };
}

function validateFreebieReward(f: FreebieReward): string | null {
  if (!f.productId || !ObjectId.isValid(f.productId)) {
    return "Invalid freebie productId";
  }
  if (!f.quantity || f.quantity < 1) {
    return "Freebie quantity must be at least 1";
  }
  if (f.promoPrice != null && f.promoPrice < 0) {
    return "promoPrice must be >= 0";
  }
  return null;
}

function validateDiscountReward(d: DiscountReward): string | null {
  if (d.kind !== "flat" && d.kind !== "percent") {
    return "Discount kind must be flat or percent";
  }
  if (typeof d.value !== "number" || d.value <= 0) {
    return "Discount value must be positive";
  }
  if (d.kind === "percent" && d.value > 100) {
    return "Percent discount cannot exceed 100";
  }
  return null;
}

export function validateOfferInput(
  body: Partial<Offer>,
  isUpdate = false,
): { valid: boolean; message?: string } {
  if (!isUpdate) {
    if (!body.type || (body.type !== "freebie" && body.type !== "discount")) {
      return { valid: false, message: "type must be freebie or discount" };
    }
  }

  if (body.minOrderValue != null && body.minOrderValue < 0) {
    return { valid: false, message: "minOrderValue must be >= 0" };
  }

  if (body.type === "freebie" || body.freebies?.length) {
    const freebies = body.freebies ?? [];
    if (freebies.length === 0) {
      return {
        valid: false,
        message: "freebie offer requires at least one freebie",
      };
    }
    for (const f of freebies) {
      const err = validateFreebieReward(f);
      if (err) return { valid: false, message: err };
    }
  }

  if (body.type === "discount" || body.discount) {
    if (!body.discount) {
      return {
        valid: false,
        message: "discount offer requires discount object",
      };
    }
    const err = validateDiscountReward(body.discount);
    if (err) return { valid: false, message: err };
  }

  return { valid: true };
}

export async function validateOfferProductsExist(
  db: Db,
  offer: Partial<Offer>,
): Promise<{ valid: boolean; message?: string }> {
  if (offer.type !== "freebie" && !offer.freebies?.length) {
    return { valid: true };
  }
  for (const f of offer.freebies ?? []) {
    const product = await db
      .collection("products")
      .findOne({ _id: new ObjectId(f.productId) });
    if (!product) {
      return { valid: false, message: `Product not found: ${f.productId}` };
    }
    if (!(product as { promoOnly?: boolean }).promoOnly) {
      return {
        valid: false,
        message: `Freebie product must be promo-only: ${product.name ?? f.productId}`,
      };
    }
  }
  return { valid: true };
}

export function buildOfferFromInput(
  body: Partial<Offer>,
  existing?: Offer,
): Offer {
  const now = new Date().toISOString();
  return {
    id: existing?.id ?? body.id ?? crypto.randomUUID(),
    enabled: body.enabled ?? existing?.enabled ?? true,
    type: (body.type ?? existing?.type ?? "freebie") as Offer["type"],
    minOrderValue: Number(body.minOrderValue ?? existing?.minOrderValue ?? 0),
    sortOrder: Number(body.sortOrder ?? existing?.sortOrder ?? 0),
    freebies:
      body.type === "discount"
        ? undefined
        : (body.freebies ?? existing?.freebies),
    discount:
      body.type === "freebie"
        ? undefined
        : (body.discount ?? existing?.discount),
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
}
