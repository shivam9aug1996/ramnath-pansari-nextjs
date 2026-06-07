import { database } from "../../../lib/firebase";
import { ref, set, remove } from "firebase/database";

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
  console.log("jgfrew34567890-=", order, {
    userId: userId,
    orderId: orderId,
  });

  if (!order) throw new Error("Order not found");

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

  try {
    const locationRef = ref(database, `drivers/${orderId}/locations`);

    const orderStatusRef = ref(database, `orders/${userId}/order/status`);
    await set(orderStatusRef, {
      trigger: true,
      status: newStatus,
      orderId: orderId,
      userId: userId,
      timestamp: timestamp,
      _id: order?._id?.toString(),
    });
    if (newStatus !== "out_for_delivery") {
      await remove(locationRef);
    }
    setTimeout(async () => {
      await remove(orderStatusRef);
    }, 2000);
  } catch (error) {
    console.error("Error updating Firebase:", error);
  }

  return { newStatus, timestamp };
}
