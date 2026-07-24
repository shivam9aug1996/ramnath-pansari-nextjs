import type { Db } from "mongodb";
import { getStoreSettings } from "@/app/api/offers/offerUtils";
import {
  STORE_SETTINGS_ID,
  storeSettingsCollection,
} from "@/app/api/offers/storeSettingsUtils";
import {
  DEFAULT_HOME_PRODUCT_PROMO,
  type HomeProductPromo,
} from "./homePromoTypes";

export async function getHomeProductPromo(
  db: Db,
): Promise<HomeProductPromo> {
  const settings = await getStoreSettings(db);
  const promo = settings.homeProductPromo;
  if (!promo) return { ...DEFAULT_HOME_PRODUCT_PROMO };
  return normalizeHomeProductPromo(promo);
}

export async function saveHomeProductPromo(
  db: Db,
  promo: HomeProductPromo,
): Promise<void> {
  await storeSettingsCollection(db).updateOne(
    { _id: STORE_SETTINGS_ID },
    {
      $set: {
        homeProductPromo: promo,
        updatedAt: new Date(),
      },
      $setOnInsert: { _id: STORE_SETTINGS_ID },
    },
    { upsert: true },
  );
}

export function normalizeHomeProductPromo(
  promo: Partial<HomeProductPromo>,
): HomeProductPromo {
  const now = new Date().toISOString();
  return {
    id: promo.id?.trim() || DEFAULT_HOME_PRODUCT_PROMO.id,
    enabled: Boolean(promo.enabled),
    productId: promo.productId?.trim() || "",
    productName: promo.productName?.trim() || "",
    title: promo.title?.trim() || DEFAULT_HOME_PRODUCT_PROMO.title,
    ctaLabel: promo.ctaLabel?.trim() || DEFAULT_HOME_PRODUCT_PROMO.ctaLabel,
    videoUrl: promo.videoUrl?.trim() || "",
    posterUrl: promo.posterUrl?.trim() || "",
    startsAt: promo.startsAt ?? null,
    endsAt: promo.endsAt ?? null,
    createdAt: promo.createdAt || now,
    updatedAt: promo.updatedAt || now,
  };
}

export function isHomeProductPromoActive(
  promo: HomeProductPromo,
  now = new Date(),
): boolean {
  if (!promo.enabled) return false;
  if (!promo.videoUrl && !promo.posterUrl) return false;

  if (promo.startsAt) {
    const start = new Date(promo.startsAt).getTime();
    if (!Number.isNaN(start) && now.getTime() < start) return false;
  }
  if (promo.endsAt) {
    const end = new Date(promo.endsAt).getTime();
    if (!Number.isNaN(end) && now.getTime() > end) return false;
  }
  return true;
}

export function validateHomeProductPromoInput(
  body: Partial<HomeProductPromo>,
): { valid: boolean; message?: string } {
  if (body.enabled === true) {
    const hasMedia = Boolean(body.videoUrl?.trim() || body.posterUrl?.trim());
    if (!hasMedia) {
      return {
        valid: false,
        message: "videoUrl or posterUrl is required when enabled",
      };
    }
  }
  return { valid: true };
}

/** Public payload: null when inactive. */
export function toPublicHomePromo(
  promo: HomeProductPromo,
): HomeProductPromo | null {
  if (!isHomeProductPromoActive(promo)) return null;
  return normalizeHomeProductPromo(promo);
}
