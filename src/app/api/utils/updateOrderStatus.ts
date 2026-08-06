import { syncActiveOrderToFirebase } from "./syncActiveOrderToFirebase";
import {
  releaseProductLocksForOrder,
  shouldReleaseProductLocks,
} from "./productPendingLock";
import { OrderStatus } from "../order/orderStatus";

export async function updateOrderStatus(
  db: any,
  orderId: string,
  newStatus: string,
  userId: string,
) {
  const order = await db.collection("orders").findOne({
    userId: userId,
    orderId: orderId,
  });

  if (!order) throw new Error("Order not found");

  const prevStatus = order.orderStatus;
  const timestamp = new Date().toISOString();
  const updateResult = await db.collection("orders").updateOne(
    { orderId },
    {
      $set: { orderStatus: newStatus, updatedAt: timestamp },
      $push: {
        orderHistory: {
          $each: [
            {
              status: newStatus,
              timestamp: timestamp,
            },
          ],
          $position: 0,
        },
      },
    },
  );

  if (updateResult.modifiedCount === 0) {
    throw new Error("Failed to update order status");
  }

  const normalized = String(newStatus ?? "").toLowerCase();
  const otp =
    normalized === OrderStatus.DELIVERED ||
    normalized === OrderStatus.CANCELED
      ? null
      : (order.deliveryOtp as string | undefined) ?? null;

  await syncActiveOrderToFirebase({
    userId,
    mongoOrderId: order._id.toString(),
    orderId,
    status: newStatus,
    imgArr: order.imgArr,
    amountPaid: order.amountPaid,
    totalProductCount: order.totalProductCount,
    deliveryOtp: otp,
  });

  if (shouldReleaseProductLocks(prevStatus, newStatus)) {
    await releaseProductLocksForOrder(order);
  }

  return { newStatus, timestamp };
}
