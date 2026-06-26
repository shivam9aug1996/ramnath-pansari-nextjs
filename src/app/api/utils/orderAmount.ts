import { CartItem } from "@/types/api";
import {
  DEFAULT_DELIVERY_SETTINGS,
  type DeliverySettings,
} from "@/app/api/delivery/deliverySettingsTypes";

export const FREE_DELIVERY_MIN = DEFAULT_DELIVERY_SETTINGS.freeDeliveryMin;
export const SHIPPING_FEE = DEFAULT_DELIVERY_SETTINGS.shippingFee;

export function calculateCartSubtotal(items: CartItem[] = []): number {
  return items.reduce((total, product) => {
    const details = product?.productDetails as
      | { discountedPrice?: number }
      | undefined;
    const productTotal = details?.discountedPrice
      ? parseFloat((details.discountedPrice * product.quantity).toFixed(2))
      : 0;
    return parseFloat(total.toFixed(2)) + productTotal;
  }, 0);
}

export function getDeliveryFee(
  subtotal: number,
  settings: DeliverySettings = DEFAULT_DELIVERY_SETTINGS,
): number {
  if (!subtotal || subtotal <= 0) return 0;
  return subtotal >= settings.freeDeliveryMin ? 0 : settings.shippingFee;
}

export function getPayableAmount(
  subtotal: number,
  settings: DeliverySettings = DEFAULT_DELIVERY_SETTINGS,
): number {
  return parseFloat((subtotal + getDeliveryFee(subtotal, settings)).toFixed(2));
}

export function getPayableAmountFromCart(
  items: CartItem[] = [],
  settings: DeliverySettings = DEFAULT_DELIVERY_SETTINGS,
): number {
  return getPayableAmount(calculateCartSubtotal(items), settings);
}
