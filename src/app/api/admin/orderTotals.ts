import {
  calculateCartSubtotal,
  getDeliveryFee,
  getPayableAmount,
} from "@/app/api/utils/orderAmount";
import type { DeliverySettings } from "@/app/api/delivery/deliverySettingsTypes";
import type { CartItem } from "@/types/api";

export function computeOrderTotalsFromCart(
  cartData: {
    cart?: { items?: CartItem[] };
    orderDiscount?: number;
  },
  deliverySettings: DeliverySettings,
) {
  const items = cartData?.cart?.items ?? [];
  const orderDiscount = Number(cartData?.orderDiscount) || 0;
  const subtotal = calculateCartSubtotal(items);
  const deliveryFee = getDeliveryFee(subtotal, deliverySettings);
  const amountPaid = getPayableAmount(subtotal, deliverySettings, orderDiscount);

  return {
    subtotal,
    deliveryFee,
    orderDiscount,
    amountPaid: amountPaid.toFixed(2),
    productCount: items.length,
    totalProductCount: items.reduce(
      (sum, item) => sum + Number(item?.quantity || 0),
      0,
    ),
    imgArr: items
      .map((item) => item?.productDetails?.image)
      .filter(Boolean)
      .slice(0, 3) as string[],
  };
}
