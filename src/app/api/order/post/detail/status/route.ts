import { NextRequest, NextResponse } from "next/server";
import { isTokenVerified } from "@/json";
import { connectDB } from "@/app/api/lib/dbconnection";
import { Expo, ExpoPushMessage } from "expo-server-sdk";
import { updateOrderStatus } from "@/app/api/utils/updateOrderStatus";
const expo = new Expo({});

export async function PUT(req: NextRequest) {
  try {
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
    if (!newStatus) {
      return NextResponse.json(
        { message: "Missing new order status" },
        { status: 400 },
      );
    }

    const tokenVerificationResponse = await isTokenVerified(req);
    if (tokenVerificationResponse) {
      return tokenVerificationResponse;
    }

    const db = await connectDB(req);

    await updateOrderStatus(db, orderId, newStatus, userId);

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
