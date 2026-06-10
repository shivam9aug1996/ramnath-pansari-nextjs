import { connectDB } from "@/app/api/lib/dbconnection";
import { OrderStatus } from "@/app/api/order/orderStatus";

const TRACKABLE_STATUSES = new Set<string>([
  OrderStatus.CONFIRMED,
  OrderStatus.OUT_FOR_DELIVERY,
]);

export type TrackingOrderSuccess = {
  ok: true;
  orderId: string;
  orderStatus: string;
  customerLocation: { lat: number; lng: number };
};

export type TrackingOrderFailure = {
  ok: false;
  reason: "not_found" | "not_trackable" | "missing_location";
  message: string;
};

export type TrackingOrderResult = TrackingOrderSuccess | TrackingOrderFailure;

export async function getTrackingOrder(
  orderId: string,
): Promise<TrackingOrderResult> {
  const db = await connectDB();
  const order = await db.collection("orders").findOne({ orderId });

  if (!order) {
    return {
      ok: false,
      reason: "not_found",
      message: "Order not found",
    };
  }

  const orderStatus = String(order.orderStatus ?? order.status ?? "");
  if (!TRACKABLE_STATUSES.has(orderStatus)) {
    return {
      ok: false,
      reason: "not_trackable",
      message: "Live tracking is not available for this order",
    };
  }

  const lat = parseFloat(String(order.addressData?.latitude ?? ""));
  const lng = parseFloat(String(order.addressData?.longitude ?? ""));
  if (Number.isNaN(lat) || Number.isNaN(lng)) {
    return {
      ok: false,
      reason: "missing_location",
      message: "Delivery address location is unavailable",
    };
  }

  return {
    ok: true,
    orderId,
    orderStatus,
    customerLocation: { lat, lng },
  };
}
