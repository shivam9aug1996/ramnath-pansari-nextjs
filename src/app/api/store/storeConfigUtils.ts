import type { Db } from "mongodb";
import { getStoreSettings } from "@/app/api/offers/offerUtils";
import {
  STORE_SETTINGS_ID,
  storeSettingsCollection,
} from "@/app/api/offers/storeSettingsUtils";
import { bumpSyncVersion } from "@/app/api/app/syncVersionsUtils";
import {
  DEFAULT_STORE_CONFIG,
  type DeliveryRadiusSettings,
  type StoreConfig,
  type StoreHoursSettings,
} from "./storeConfigTypes";

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

export async function getStoreConfig(db: Db): Promise<StoreConfig> {
  const settings = await getStoreSettings(db);
  return normalizeStoreConfig(settings.storeConfig);
}

export async function saveStoreConfig(
  db: Db,
  storeConfig: StoreConfig,
): Promise<void> {
  await storeSettingsCollection(db).updateOne(
    { _id: STORE_SETTINGS_ID },
    {
      $set: {
        storeConfig: normalizeStoreConfig(storeConfig),
        updatedAt: new Date(),
      },
      $setOnInsert: { _id: STORE_SETTINGS_ID },
    },
    { upsert: true },
  );
  await bumpSyncVersion(db, "storeConfig");
}

export function normalizeStoreConfig(
  config?: Partial<StoreConfig> | null,
): StoreConfig {
  return {
    acceptingOrders: config?.acceptingOrders !== false,
    storeHours: normalizeStoreHours(config?.storeHours),
    deliveryRadius: normalizeDeliveryRadius(config?.deliveryRadius),
  };
}

export function normalizeStoreHours(
  settings?: Partial<StoreHoursSettings> | null,
): StoreHoursSettings {
  const openTime = settings?.openTime ?? DEFAULT_STORE_CONFIG.storeHours.openTime;
  const closeTime =
    settings?.closeTime ?? DEFAULT_STORE_CONFIG.storeHours.closeTime;
  const timezone =
    settings?.timezone ?? DEFAULT_STORE_CONFIG.storeHours.timezone;

  return {
    openTime: TIME_PATTERN.test(openTime)
      ? openTime
      : DEFAULT_STORE_CONFIG.storeHours.openTime,
    closeTime: TIME_PATTERN.test(closeTime)
      ? closeTime
      : DEFAULT_STORE_CONFIG.storeHours.closeTime,
    timezone: timezone.trim() || DEFAULT_STORE_CONFIG.storeHours.timezone,
  };
}

export function normalizeDeliveryRadius(
  settings?: Partial<DeliveryRadiusSettings> | null,
): DeliveryRadiusSettings {
  return {
    radiusKm: Math.max(
      0.1,
      Number(settings?.radiusKm ?? DEFAULT_STORE_CONFIG.deliveryRadius.radiusKm),
    ),
    centerLatitude: Number(
      settings?.centerLatitude ??
        DEFAULT_STORE_CONFIG.deliveryRadius.centerLatitude,
    ),
    centerLongitude: Number(
      settings?.centerLongitude ??
        DEFAULT_STORE_CONFIG.deliveryRadius.centerLongitude,
    ),
  };
}

export function validateStoreConfigInput(
  body: Partial<StoreConfig>,
): { valid: boolean; message?: string } {
  if (body.storeHours) {
    const { openTime, closeTime } = body.storeHours;
    if (openTime != null && !TIME_PATTERN.test(openTime)) {
      return { valid: false, message: "openTime must be HH:mm (24h)" };
    }
    if (closeTime != null && !TIME_PATTERN.test(closeTime)) {
      return { valid: false, message: "closeTime must be HH:mm (24h)" };
    }
    if (openTime && closeTime && openTime >= closeTime) {
      return {
        valid: false,
        message: "openTime must be before closeTime",
      };
    }
  }

  if (body.deliveryRadius) {
    const { radiusKm, centerLatitude, centerLongitude } = body.deliveryRadius;
    if (radiusKm != null && radiusKm <= 0) {
      return { valid: false, message: "radiusKm must be > 0" };
    }
    if (
      centerLatitude != null &&
      (centerLatitude < -90 || centerLatitude > 90)
    ) {
      return { valid: false, message: "centerLatitude must be between -90 and 90" };
    }
    if (
      centerLongitude != null &&
      (centerLongitude < -180 || centerLongitude > 180)
    ) {
      return {
        valid: false,
        message: "centerLongitude must be between -180 and 180",
      };
    }
  }

  return { valid: true };
}

function parseTimeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return (hours ?? 0) * 60 + (minutes ?? 0);
}

function getZonedMinutes(date: Date, timezone: string): number {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  return hour * 60 + minute;
}

export function isStoreOpen(
  storeHours: StoreHoursSettings,
  now: Date = new Date(),
): boolean {
  const normalized = normalizeStoreHours(storeHours);
  const nowMinutes = getZonedMinutes(now, normalized.timezone);
  const openMinutes = parseTimeToMinutes(normalized.openTime);
  const closeMinutes = parseTimeToMinutes(normalized.closeTime);
  return nowMinutes >= openMinutes && nowMinutes < closeMinutes;
}

export function getDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function isWithinDeliveryRadius(
  latitude: number,
  longitude: number,
  deliveryRadius: DeliveryRadiusSettings,
): { isWithin: boolean; distanceKm: number } {
  const normalized = normalizeDeliveryRadius(deliveryRadius);
  const distanceKm = getDistanceKm(
    normalized.centerLatitude,
    normalized.centerLongitude,
    latitude,
    longitude,
  );
  return {
    isWithin: distanceKm <= normalized.radiusKm,
    distanceKm,
  };
}

export function canAcceptOrders(
  storeConfig: StoreConfig,
  now: Date = new Date(),
): boolean {
  const normalized = normalizeStoreConfig(storeConfig);
  if (!normalized.acceptingOrders) return false;
  return isStoreOpen(normalized.storeHours, now);
}

export function getStoreClosedMessage(storeConfig: StoreConfig): string {
  const normalized = normalizeStoreConfig(storeConfig);
  if (!normalized.acceptingOrders) {
    return "We're not accepting orders right now. Please check back later.";
  }
  const { openTime, closeTime } = normalized.storeHours;
  return `Orders are accepted between ${openTime} and ${closeTime}. Please try again during store hours.`;
}

export function validateOrderPlacement(
  addressData: { latitude?: number | null; longitude?: number | null } | null,
  storeConfig: StoreConfig,
): { ok: true } | { ok: false; code: string; message: string } {
  const normalized = normalizeStoreConfig(storeConfig);

  if (!normalized.acceptingOrders) {
    return {
      ok: false,
      code: "STORE_CLOSED",
      message: getStoreClosedMessage(normalized),
    };
  }

  if (!isStoreOpen(normalized.storeHours)) {
    return {
      ok: false,
      code: "STORE_CLOSED",
      message: getStoreClosedMessage(normalized),
    };
  }

  const lat = addressData?.latitude;
  const lng = addressData?.longitude;
  if (lat == null || lng == null) {
    return {
      ok: false,
      code: "ADDRESS_LOCATION_MISSING",
      message: "Delivery address location is required.",
    };
  }

  const radiusCheck = isWithinDeliveryRadius(lat, lng, storeConfig.deliveryRadius);
  if (!radiusCheck.isWithin) {
    const radiusKm = normalizeDeliveryRadius(storeConfig.deliveryRadius).radiusKm;
    return {
      ok: false,
      code: "OUTSIDE_DELIVERY_RADIUS",
      message: `Sorry, we only deliver within ${radiusKm} km of the store.`,
    };
  }

  return { ok: true };
}
