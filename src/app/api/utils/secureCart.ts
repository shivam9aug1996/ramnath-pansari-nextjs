import type { Db } from "mongodb";
import { ObjectId } from "mongodb";
import type { CartItem } from "@/types/api";
import { isPromoFreebieItem } from "@/app/api/offers/applyOffers";

const DEFAULT_MAX_QUANTITY = 99;
const MAX_ADDRESS_STRING = 200;

function getLineProductId(item: CartItem): string {
  return (
    item.productId?.toString() ??
    (item.productDetails as { _id?: { toString(): string } | string })?._id
      ?.toString?.() ??
    ""
  );
}

/**
 * Rebuild paid cart lines from DB product documents so client prices cannot be trusted.
 * Promo freebies are stripped; callers should run applyOffersToCart afterward.
 */
export async function rehydrateCartItemsFromDb(
  db: Db,
  items: CartItem[] = [],
): Promise<
  | { ok: true; items: CartItem[] }
  | { ok: false; message: string; code?: string }
> {
  const paidItems = items.filter((item) => !isPromoFreebieItem(item));
  if (!paidItems.length) {
    return { ok: false, message: "Cart is empty", code: "EMPTY_CART" };
  }

  const rehydrated: CartItem[] = [];

  for (const item of paidItems) {
    const productId = getLineProductId(item);
    if (!productId || !ObjectId.isValid(productId)) {
      return {
        ok: false,
        message: "Invalid product in cart",
        code: "INVALID_PRODUCT",
      };
    }

    const quantityRaw = Number(item.quantity);
    if (!Number.isFinite(quantityRaw) || quantityRaw <= 0) {
      continue;
    }

    const product = await db
      .collection("products")
      .findOne({ _id: new ObjectId(productId) });

    if (!product) {
      return {
        ok: false,
        message: "One or more products are unavailable",
        code: "PRODUCT_NOT_FOUND",
      };
    }

    if (product.isOutOfStock) {
      return {
        ok: false,
        message: "One or more products are out of stock",
        code: "OUT_OF_STOCK",
      };
    }

    const maxQuantity =
      typeof product.maxQuantity === "number" && product.maxQuantity > 0
        ? product.maxQuantity
        : DEFAULT_MAX_QUANTITY;
    const quantity = Math.min(Math.floor(quantityRaw), maxQuantity);
    if (quantity <= 0) continue;

    rehydrated.push({
      productId: new ObjectId(productId),
      productDetails: product,
      quantity,
    } as CartItem);
  }

  if (!rehydrated.length) {
    return { ok: false, message: "Cart is empty", code: "EMPTY_CART" };
  }

  return { ok: true, items: rehydrated };
}

/** Allowlist address fields stored on orders / userAddresses. */
export function sanitizeAddressData(
  address: Record<string, unknown> | null | undefined,
): Record<string, unknown> | null {
  if (!address || typeof address !== "object") return null;

  const clip = (value: unknown, max = MAX_ADDRESS_STRING) => {
    if (typeof value !== "string") return undefined;
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    return trimmed.slice(0, max);
  };

  const latitude = Number(address.latitude);
  const longitude = Number(address.longitude);

  const sanitized: Record<string, unknown> = {};
  const houseNumber = clip(address.houseNumber ?? address.houseNo);
  const buildingName = clip(address.buildingName);
  const colonyArea = clip(address.colonyArea ?? address.area);
  const city = clip(address.city);
  const state = clip(address.state);
  const pincode = clip(address.pincode ?? address.pinCode, 12);
  const landmark = clip(address.landmark);
  const label = clip(address.label ?? address.addressType, 40);
  const receiverName = clip(
    address.receiverName ?? address.name ?? address.fullName,
  );
  const receiverPhone = clip(
    address.receiverPhone ?? address.phone ?? address.mobileNumber,
    15,
  );
  const mapImage = clip(address.mapImage, 500);
  const floor = clip(address.floor, 20);
  const street = clip(address.street);
  const addressType = clip(address.addressType, 40);
  const addressLine = clip(address.address, 500);

  if (houseNumber) sanitized.houseNumber = houseNumber;
  if (buildingName) sanitized.buildingName = buildingName;
  if (colonyArea) sanitized.colonyArea = colonyArea;
  if (city) sanitized.city = city;
  if (state) sanitized.state = state;
  if (pincode) sanitized.pincode = pincode;
  if (landmark) sanitized.landmark = landmark;
  if (label) sanitized.label = label;
  if (receiverName) {
    sanitized.receiverName = receiverName;
    sanitized.name = receiverName;
  }
  if (receiverPhone) {
    sanitized.receiverPhone = receiverPhone;
    sanitized.phone = receiverPhone;
  }
  if (mapImage) sanitized.mapImage = mapImage;
  if (floor) sanitized.floor = floor;
  if (street) sanitized.street = street;
  if (addressType) sanitized.addressType = addressType;
  if (addressLine) sanitized.address = addressLine;
  if (Number.isFinite(latitude)) sanitized.latitude = latitude;
  if (Number.isFinite(longitude)) sanitized.longitude = longitude;
  if (address._id) sanitized._id = address._id;

  return sanitized;
}

export function clampCartQuantity(
  quantity: number,
  maxQuantity?: number | null,
): number {
  const max =
    typeof maxQuantity === "number" && maxQuantity > 0
      ? maxQuantity
      : DEFAULT_MAX_QUANTITY;
  if (!Number.isFinite(quantity) || quantity < 0) return 0;
  return Math.min(Math.floor(quantity), max);
}
