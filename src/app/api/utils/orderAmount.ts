import { CartItem } from "@/types/api";

export const FREE_DELIVERY_MIN = 200;
export const SHIPPING_FEE = 50;

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

export function getDeliveryFee(subtotal: number): number {
  if (!subtotal || subtotal <= 0) return 0;
  return subtotal >= FREE_DELIVERY_MIN ? 0 : SHIPPING_FEE;
}

export function getPayableAmount(subtotal: number): number {
  return parseFloat((subtotal + getDeliveryFee(subtotal)).toFixed(2));
}

export function getPayableAmountFromCart(items: CartItem[] = []): number {
  return getPayableAmount(calculateCartSubtotal(items));
}
