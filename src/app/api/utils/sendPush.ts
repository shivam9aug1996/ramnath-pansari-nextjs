import { Expo } from "expo-server-sdk";
const expo = new Expo({});
export async function sendPushNotification(
  response: any,
) {
  const { deviceToken, orderId, userId } = response;
  let pushArr = [
    {
      to: deviceToken,
      sound: "default",
      data: { orderPlaced: true, orderId, userId },
      priority: "high",
      title: "Order placed successfully",
    },
    {
      to: deviceToken,
      sound: "default",
      data: { orderPlaced: true, orderId, userId },
      priority: "high",
    },
  ];
  let tickets = await expo.sendPushNotificationsAsync(pushArr);

  let okStatusArray: string[] = [];
  tickets?.forEach((item) => {
    if (item?.status === "ok") {
      okStatusArray.push(item?.id);
    }
  });
  let receipts = await expo.getPushNotificationReceiptsAsync(okStatusArray);
  for (let receiptId in receipts) {
    let { status } = receipts[receiptId];
    if (status === "ok") {
      continue;
    } else if (status === "error") {
      console.error(`There was an error sending a notification`);
    }
  }
}
