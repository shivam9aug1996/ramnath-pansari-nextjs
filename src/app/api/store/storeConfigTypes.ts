export type StoreHoursSettings = {
  openTime: string;
  closeTime: string;
  timezone: string;
};

export type DeliveryRadiusSettings = {
  radiusKm: number;
  centerLatitude: number;
  centerLongitude: number;
};

export type StoreConfig = {
  /** When false, orders are blocked regardless of scheduled hours. */
  acceptingOrders: boolean;
  storeHours: StoreHoursSettings;
  deliveryRadius: DeliveryRadiusSettings;
};

export const DEFAULT_STORE_HOURS: StoreHoursSettings = {
  openTime: "09:00",
  closeTime: "21:00",
  timezone: "Asia/Kolkata",
};

export const DEFAULT_DELIVERY_RADIUS: DeliveryRadiusSettings = {
  radiusKm: 5,
  centerLatitude: 28.713074,
  centerLongitude: 77.65419,
};

export const DEFAULT_STORE_CONFIG: StoreConfig = {
  acceptingOrders: true,
  storeHours: DEFAULT_STORE_HOURS,
  deliveryRadius: DEFAULT_DELIVERY_RADIUS,
};
