import {
  calculateCartSubtotal,
  getDeliveryFee,
  getPayableAmount,
} from "@/app/api/utils/orderAmount";

type CartItem = {
  quantity?: number;
  productDetails?: { discountedPrice?: number; image?: string };
};

export function computeOrderTotalsFromCart(cartData: {
  cart?: { items?: CartItem[] };
}) {
  const items = cartData?.cart?.items ?? [];
  const subtotal = calculateCartSubtotal(items);
  const deliveryFee = getDeliveryFee(subtotal);
  const amountPaid = getPayableAmount(subtotal);

  return {
    subtotal,
    deliveryFee,
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
