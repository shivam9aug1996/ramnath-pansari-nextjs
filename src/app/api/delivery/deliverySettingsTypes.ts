export type DeliverySettings = {
  freeDeliveryMin: number;
  shippingFee: number;
};

export const DEFAULT_DELIVERY_SETTINGS: DeliverySettings = {
  freeDeliveryMin: 200,
  shippingFee: 50,
};
