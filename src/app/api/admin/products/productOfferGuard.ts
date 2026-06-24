import type { Db } from "mongodb";
import { getAllOffers } from "@/app/api/offers/offerUtils";

export type LiveOfferProductUsage = {
  offerId: string;
  minOrderValue: number;
  promoPrice: number;
  quantity: number;
};

export type ProductOfferUsage = {
  inLiveOffer: boolean;
  liveOffers: LiveOfferProductUsage[];
  canDelete: boolean;
  blockedFields: ("promoOnly" | "delete")[];
  safeToEdit: string[];
  blockedEdits: { field: string; reason: string }[];
  notes: string[];
};

export async function getLiveOffersUsingProduct(
  db: Db,
  productId: string,
): Promise<LiveOfferProductUsage[]> {
  const offers = await getAllOffers(db);
  const matches: LiveOfferProductUsage[] = [];

  for (const offer of offers) {
    if (!offer.enabled || offer.type !== "freebie") continue;
    for (const freebie of offer.freebies ?? []) {
      if (freebie.productId !== productId) continue;
      matches.push({
        offerId: offer.id,
        minOrderValue: offer.minOrderValue,
        promoPrice: freebie.promoPrice ?? 0,
        quantity: freebie.quantity ?? 1,
      });
    }
  }

  return matches;
}

export function buildProductOfferUsage(
  liveOffers: LiveOfferProductUsage[],
): ProductOfferUsage {
  const inLiveOffer = liveOffers.length > 0;

  const notes = inLiveOffer
    ? [
        "What customers pay comes from the offer promo price, not this product's selling price.",
        "To change gift pricing, edit the offer — not selling price here.",
      ]
    : [];

  const blockedEdits: { field: string; reason: string }[] = [];
  const blockedFields: ("promoOnly" | "delete")[] = [];

  if (inLiveOffer) {
    blockedFields.push("promoOnly", "delete");
    blockedEdits.push({
      field: "promoOnly",
      reason:
        "Keep Promo / freebie on while this product is in a live offer. Disable the offer first to turn this off.",
    });
    blockedEdits.push({
      field: "delete",
      reason:
        "Remove or disable live offers using this product before deleting it.",
    });
    notes.push(
      "Out of stock does not stop offer freebies yet — disable the offer if you need to pause the gift.",
    );
  }

  return {
    inLiveOffer,
    liveOffers,
    canDelete: !inLiveOffer,
    blockedFields,
    safeToEdit: [
      "Name, image, size, brand",
      "MRP (savings display only)",
      "Selling price (does not change offer promo price)",
      "Store category & max quantity",
    ],
    blockedEdits,
    notes,
  };
}

export function validateProductUpdateAgainstLiveOffers(
  existing: { promoOnly?: boolean },
  body: Record<string, unknown>,
  liveOffers: LiveOfferProductUsage[],
): { valid: boolean; message?: string } {
  if (liveOffers.length === 0) return { valid: true };

  const nextPromoOnly =
    body.promoOnly != null
      ? Boolean(body.promoOnly)
      : Boolean(existing.promoOnly);

  if (Boolean(existing.promoOnly) && !nextPromoOnly) {
    const offerIds = liveOffers.map((o) => o.offerId).join(", ");
    return {
      valid: false,
      message: `Cannot turn off promo-only while used in live offer(s). Disable those offers first. (${offerIds})`,
    };
  }

  return { valid: true };
}

export function validateProductDeleteAgainstLiveOffers(
  liveOffers: LiveOfferProductUsage[],
): { valid: boolean; message?: string } {
  if (liveOffers.length === 0) return { valid: true };

  const offerIds = liveOffers.map((o) => o.offerId).join(", ");
  return {
    valid: false,
    message: `Cannot delete — product is used in live offer(s). Disable or edit those offers first. (${offerIds})`,
  };
}
