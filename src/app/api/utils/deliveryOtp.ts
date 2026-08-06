import { randomInt, timingSafeEqual } from "crypto";
import { Expo, ExpoPushMessage } from "expo-server-sdk";

const expo = new Expo({});

export const MAX_DELIVERY_OTP_ATTEMPTS = 5;
export const RESEND_OTP_COOLDOWN_MS = 60_000;

export function generateDeliveryOtp(): string {
  return String(randomInt(1000, 10000));
}

export function otpMatches(expected: string | undefined | null, provided: string) {
  const a = String(expected ?? "");
  const b = String(provided ?? "").trim();
  if (!a || a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a), Buffer.from(b));
  } catch {
    return false;
  }
}

export async function sendDeliveryOtpPush(params: {
  db: { collection: (name: string) => { findOne: Function } };
  userId: string;
  mongoOrderId: string;
  humanOrderId: string;
  deliveryOtp: string;
}): Promise<void> {
  const { db, userId, mongoOrderId, humanOrderId, deliveryOtp } = params;
  if (!userId || !deliveryOtp) return;

  try {
    const tokensDoc = await db.collection("pushTokens").findOne({ userId });
    const tokens: string[] = (tokensDoc?.tokens || []).filter(
      (t: string) => typeof t === "string" && Expo.isExpoPushToken(t),
    );
    if (!tokens.length) return;

    const displayOrderId = humanOrderId || mongoOrderId.slice(-6);
    const messages: ExpoPushMessage[] = tokens.map((to) => ({
      to,
      sound: "default",
      priority: "high",
      title: "Delivery code",
      subtitle: `Order #${displayOrderId}`,
      body: `Your delivery OTP is ${deliveryOtp}. Share it only with the delivery person.`,
      data: {
        updateOrderStatus: true,
        orderId: mongoOrderId,
        userId,
        deliveryOtp: true,
      },
    }));

    const tickets = await expo.sendPushNotificationsAsync(messages);
    const okIds: string[] = [];
    tickets?.forEach((ticket) => {
      if (ticket?.status === "ok") okIds.push(ticket.id);
    });
    if (okIds.length) {
      await expo.getPushNotificationReceiptsAsync(okIds);
    }
  } catch (error) {
    console.error("[deliveryOtp] push error:", error);
  }
}
