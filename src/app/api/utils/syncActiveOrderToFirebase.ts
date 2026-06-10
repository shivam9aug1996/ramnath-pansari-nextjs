import { database } from "../../../lib/firebase";
import { ref, remove, set } from "firebase/database";
import { OrderStatus } from "../order/orderStatus";

const ACTIVE_STATUSES = new Set<string>([
  OrderStatus.CONFIRMED,
  OrderStatus.OUT_FOR_DELIVERY,
]);

const TERMINAL_STATUSES = new Set<string>([
  OrderStatus.DELIVERED,
  OrderStatus.CANCELED,
]);

export type SyncActiveOrderPayload = {
  userId: string;
  mongoOrderId: string;
  orderId: string;
  status: string;
  imgArr?: string[];
  amountPaid?: number;
  totalProductCount?: number;
};

export async function syncActiveOrderToFirebase(
  payload: SyncActiveOrderPayload,
): Promise<void> {
  const {
    userId,
    mongoOrderId,
    orderId,
    status,
    imgArr,
    amountPaid,
    totalProductCount,
  } = payload;

  const normalizedStatus = status.toLowerCase();
  const activeRef = ref(database, `orders/${userId}/active/${mongoOrderId}`);
  const timestamp = new Date().toISOString();

  const data: Record<string, unknown> = {
    status: normalizedStatus,
    orderId,
    userId,
    _id: mongoOrderId,
    updatedAt: timestamp,
  };

  if (imgArr?.length) data.imgArr = imgArr;
  if (amountPaid != null) data.amountPaid = amountPaid;
  if (totalProductCount != null) data.totalProductCount = totalProductCount;

  try {
    if (ACTIVE_STATUSES.has(normalizedStatus)) {
      await set(activeRef, data);
    } else if (TERMINAL_STATUSES.has(normalizedStatus)) {
      await set(activeRef, data);
      setTimeout(async () => {
        try {
          await remove(activeRef);
        } catch (error) {
          console.error("Error removing terminal active order:", error);
        }
      }, 3000);
    } else {
      await remove(activeRef);
    }

    if (normalizedStatus !== OrderStatus.OUT_FOR_DELIVERY) {
      const locationRef = ref(database, `drivers/${orderId}/locations`);
      await remove(locationRef);
    }
  } catch (error) {
    console.error("Error syncing active order to Firebase:", error);
  }
}
