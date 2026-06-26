import type { Db } from "mongodb";
import { getStoreSettings } from "@/app/api/offers/offerUtils";
import { storeSettingsCollection } from "@/app/api/offers/storeSettingsUtils";
import { STORE_SETTINGS_ID } from "@/app/api/offers/storeSettingsUtils";
import { bumpSyncVersion } from "@/app/api/app/syncVersionsUtils";
import {
  DEFAULT_DELIVERY_SETTINGS,
  type DeliverySettings,
} from "./deliverySettingsTypes";

export async function getDeliverySettings(db: Db): Promise<DeliverySettings> {
  const settings = await getStoreSettings(db);
  return normalizeDeliverySettings(settings.deliverySettings);
}

export async function saveDeliverySettings(
  db: Db,
  deliverySettings: DeliverySettings,
): Promise<void> {
  await storeSettingsCollection(db).updateOne(
    { _id: STORE_SETTINGS_ID },
    {
      $set: {
        deliverySettings: normalizeDeliverySettings(deliverySettings),
        updatedAt: new Date(),
      },
      $setOnInsert: { _id: STORE_SETTINGS_ID },
    },
    { upsert: true },
  );
  await bumpSyncVersion(db, "deliverySettings");
}

export function normalizeDeliverySettings(
  settings?: Partial<DeliverySettings> | null,
): DeliverySettings {
  return {
    freeDeliveryMin: Math.max(
      0,
      Number(settings?.freeDeliveryMin ?? DEFAULT_DELIVERY_SETTINGS.freeDeliveryMin),
    ),
    shippingFee: Math.max(
      0,
      Number(settings?.shippingFee ?? DEFAULT_DELIVERY_SETTINGS.shippingFee),
    ),
  };
}

export function validateDeliverySettingsInput(
  body: Partial<DeliverySettings>,
): { valid: boolean; message?: string } {
  if (body.freeDeliveryMin != null && body.freeDeliveryMin < 0) {
    return { valid: false, message: "freeDeliveryMin must be >= 0" };
  }
  if (body.shippingFee != null && body.shippingFee < 0) {
    return { valid: false, message: "shippingFee must be >= 0" };
  }
  return { valid: true };
}

export function normalizeDeliverySettingsForResponse(
  settings: DeliverySettings,
): DeliverySettings {
  return normalizeDeliverySettings(settings);
}
