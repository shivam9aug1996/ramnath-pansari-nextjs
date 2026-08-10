import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/app/api/lib/dbconnection";
import { Expo, ExpoPushMessage } from "expo-server-sdk";
import { updateOrderStatus } from "@/app/api/utils/updateOrderStatus";
import { requireAdmin } from "@/app/api/admin/requireAdmin";
import { OrderStatus } from "@/app/api/order/orderStatus";

const expo = new Expo({});

const ALLOWED_STATUSES = new Set<string>(Object.values(OrderStatus));

export async function PUT(req: NextRequest) {
  try {
    const adminError = await requireAdmin(req);
    if (adminError) return adminError;

    const { newStatus, userId, orderId, _id } = await req.json();

    if (!userId) {
      return NextResponse.json({ message: "Missing user ID" }, { status: 400 });
    }
    if (!orderId) {
      return NextResponse.json(
        { message: "Missing order ID" },
        { status: 400 },
      );
    }
    if (!newStatus || !ALLOWED_STATUSES.has(String(newStatus))) {
      return NextResponse.json(
        { message: "Invalid or missing order status" },
        { status: 400 },
      );
    }

    const db = await connectDB(req);

    await updateOrderStatus(db, orderId, String(newStatus), String(userId));

    const pushArr: ExpoPushMessage[] = [
      {
        to: "ExponentPushToken[LR57vCAo5DyzpQB0_75SQz]",
        sound: "default",
        data: { updateOrderStatus: true, orderId: _id, userId },
        priority: "high",
        title: "Order status updated successfully",
      },
      {
        to: "ExponentPushToken[LR57vCAo5DyzpQB0_75SQz]",
        sound: "default",
        data: { updateOrderStatus: true, orderId: _id, userId },
        priority: "high",
      },
    ];
    let tickets = await expo.sendPushNotificationsAsync(pushArr);
    console.log("iuytfvbn", tickets);
    let okStatusArray: string[] = [];
    tickets?.forEach((item) => {
      if (item?.status === "ok") {
        okStatusArray.push(item?.id);
      }
    });
    let receipts = await expo.getPushNotificationReceiptsAsync(okStatusArray);
    console.log("iu76trdvbnm,", receipts);
    for (let receiptId in receipts) {
      let { status } = receipts[receiptId];
      if (status === "ok") {
        console.log("notification received");
        continue;
      } else if (status === "error") {
        console.error(`There was an error sending a notification`);
      }
    }
    return NextResponse.json(
      {
        message: "Order status updated successfully",
        newStatus,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 },
    );
  }
}
