import type { Db } from "mongodb";
import { ObjectId } from "mongodb";
import type { CartItem } from "@/types/api";
import type { DiscountReward, Offer } from "./offerTypes";
import { getEnabledOffers } from "./offerUtils";

export type ExtendedCartItem = CartItem & {
  isPromoFreebie?: boolean;
  offerId?: string;
  promoPrice?: number;
};

export function isPromoFreebieItem(item: CartItem): boolean {
  return Boolean((item as ExtendedCartItem).isPromoFreebie);
}

function getLineProductId(item: CartItem): string {
  return (
    item.productId?.toString() ??
    (item.productDetails as { _id?: { toString(): string } | string })?._id
      ?.toString?.() ??
    ""
  );
}

function getLineDiscountedPrice(item: CartItem): number {
  const details = item.productDetails as { discountedPrice?: number } | null;
  return details?.discountedPrice ?? 0;
}

/** Drop legacy/non-promo lines superseded by an offer freebie at the same productId. */
export function stripSupersededFreebieLines(
  paidItems: CartItem[],
  freebiesToInject: { productId: string; promoPrice: number }[],
): CartItem[] {
  if (!freebiesToInject.length) return paidItems;

  return paidItems.filter((item) => {
    const productId = getLineProductId(item);
    const match = freebiesToInject.find((f) => f.productId === productId);
    if (!match) return true;
    // Keep only if customer pays above the promo price (real paid purchase).
    return getLineDiscountedPrice(item) > match.promoPrice;
  });
}

export function computePaidSubtotal(items: CartItem[] = []): number {
  return items
    .filter((item) => !isPromoFreebieItem(item))
    .reduce((total, item) => {
      const details = item.productDetails as
        | { discountedPrice?: number }
        | null
        | undefined;
      const price = details?.discountedPrice ?? 0;
      return parseFloat((total + price * item.quantity).toFixed(2));
    }, 0);
}

function computeDiscountAmount(
  paidSubtotal: number,
  discount: DiscountReward,
): number {
  let amount =
    discount.kind === "flat"
      ? discount.value
      : paidSubtotal * (discount.value / 100);
  if (discount.maxDiscount != null) {
    amount = Math.min(amount, discount.maxDiscount);
  }
  return parseFloat(Math.max(0, amount).toFixed(2));
}

export function movePromoItemsToTop(cart: {
  items?: CartItem[];
  [key: string]: unknown;
}) {
  if (!cart?.items?.length) return cart;

  const promos: CartItem[] = [];
  const paid: CartItem[] = [];

  for (const item of cart.items) {
    if (isPromoFreebieItem(item)) {
      promos.push(item);
    } else {
      paid.push(item);
    }
  }

  return { ...cart, items: [...promos, ...paid] };
}

export async function applyOffersToCart(
  db: Db,
  items: CartItem[] = [],
  offersOverride?: Offer[],
): Promise<{ items: CartItem[]; orderDiscount: number }> {
  const offers = offersOverride ?? (await getEnabledOffers(db));

  let paidItems = items.filter((item) => !isPromoFreebieItem(item));
  const paidSubtotal = computePaidSubtotal(paidItems);

  let orderDiscount = 0;
  const promoItems: ExtendedCartItem[] = [];
  const freebiesToInject: { productId: string; promoPrice: number }[] = [];

  const sortedOffers = [...offers].sort((a, b) => a.sortOrder - b.sortOrder);

  for (const offer of sortedOffers) {
    if (!offer.enabled || paidSubtotal < offer.minOrderValue) {
      continue;
    }

    if (offer.type === "discount" && offer.discount) {
      orderDiscount += computeDiscountAmount(paidSubtotal, offer.discount);
      continue;
    }

    if (offer.type === "freebie" && offer.freebies?.length) {
      for (const freebie of offer.freebies) {
        freebiesToInject.push({
          productId: freebie.productId,
          promoPrice: freebie.promoPrice ?? 0,
        });
      }
    }
  }

  paidItems = stripSupersededFreebieLines(paidItems, freebiesToInject);

  for (const offer of sortedOffers) {
    if (!offer.enabled || paidSubtotal < offer.minOrderValue) {
      continue;
    }

    if (offer.type !== "freebie" || !offer.freebies?.length) {
      continue;
    }

    for (const freebie of offer.freebies) {
      const product = await db.collection("products").findOne({
        _id: new ObjectId(freebie.productId),
      });
      if (!product) continue;

      const promoPrice = freebie.promoPrice ?? 0;
      const alreadyAdded = promoItems.some(
        (p) =>
          p.offerId === offer.id &&
          getLineProductId(p) === freebie.productId,
      );
      if (alreadyAdded) continue;

      const productDetails = {
        ...(product as Record<string, unknown>),
        discountedPrice: promoPrice,
      };

      promoItems.push({
        productId: new ObjectId(freebie.productId),
        quantity: freebie.quantity ?? 1,
        productDetails,
        isPromoFreebie: true,
        offerId: offer.id,
        promoPrice,
      });
    }
  }

  orderDiscount = parseFloat(orderDiscount.toFixed(2));
  const resultItems: CartItem[] = [...promoItems, ...paidItems];
  return { items: resultItems, orderDiscount };
}

export async function finalizeCartWithOffers(
  db: Db,
  userObjectId: ObjectId,
  session?: import("mongodb").ClientSession,
): Promise<{ items: CartItem[]; orderDiscount: number }> {
  const cart = await db
    .collection("carts")
    .findOne({ userId: userObjectId }, session ? { session } : undefined);

  const currentItems = (cart?.items as CartItem[]) ?? [];
  const { items, orderDiscount } = await applyOffersToCart(db, currentItems);

  await db.collection("carts").updateOne(
    { userId: userObjectId },
    { $set: { items } },
    session ? { session } : undefined,
  );

  return { items, orderDiscount };
}
