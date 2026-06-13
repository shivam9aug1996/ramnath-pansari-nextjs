import { ObjectId } from "mongodb";
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

async function findOrderByIdOrMongoId(db: Awaited<ReturnType<typeof connectDB>>, id: string) {
  const trimmed = id.trim();
  if (!trimmed) return null;

  const byOrderId = await db.collection("orders").findOne({ orderId: trimmed });
  if (byOrderId) return byOrderId;

  if (ObjectId.isValid(trimmed)) {
    try {
      return await db.collection("orders").findOne({ _id: new ObjectId(trimmed) });
    } catch {
      return null;
    }
  }

  return null;
}

export async function getTrackingOrder(
  orderIdOrMongoId: string,
): Promise<TrackingOrderResult> {
  const db = await connectDB();
  const order = await findOrderByIdOrMongoId(db, orderIdOrMongoId);

  if (!order) {
    return {
      ok: false,
      reason: "not_found",
      message: "Order not found",
    };
  }

  const canonicalOrderId = String(order.orderId ?? orderIdOrMongoId);
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
    orderId: canonicalOrderId,
    orderStatus,
    customerLocation: { lat, lng },
  };
}
