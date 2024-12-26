import { NextResponse } from "next/server";
import { isTokenVerified } from "@/json";
import { ObjectId } from "mongodb";
import { connectDB } from "@/app/api/lib/dbconnection";
import { Expo } from "expo-server-sdk";
let expo = new Expo({});

export async function PUT(req) {
  try {
    const { newStatus, userId, orderId } = await req.json();

    if (!userId) {
      return NextResponse.json({ message: "Missing user ID" }, { status: 400 });
    }
    if (!orderId) {
      return NextResponse.json(
        { message: "Missing order ID" },
        { status: 400 }
      );
    }
    if (!newStatus) {
      return NextResponse.json(
        { message: "Missing new order status" },
        { status: 400 }
      );
    }

    // Verify token (example function, replace with your authentication logic)
    const tokenVerificationResponse = await isTokenVerified(req);
    if (tokenVerificationResponse) {
      return tokenVerificationResponse;
    }

    const db = await connectDB(req);

    // Fetch the current order to validate its existence and status
    const order = await db.collection("orders").findOne({
      userId: userId,
      _id: new ObjectId(orderId),
    });

    if (!order) {
      return NextResponse.json({ message: "Order not found" }, { status: 404 });
    }

    const currentStatus = order.orderStatus;

    // Validate status transitions
    const validTransitions = {
      confirmed: ["out_for_delivery", "canceled"],
      out_for_delivery: ["delivered", "canceled"],
      delivered: [],
      canceled: [],
    };

    // if (!validTransitions[currentStatus].includes(newStatus)) {
    //   return NextResponse.json(
    //     {
    //       message: `Invalid status transition: cannot change status from '${currentStatus}' to '${newStatus}'`,
    //     },
    //     { status: 400 }
    //   );
    // }

    // Update the `orderStatus` and append the new entry to `orderHistory`
    const timestamp = new Date().toISOString();
    const updateResult = await db.collection("orders").updateOne(
      { _id: new ObjectId(orderId) },
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
            $position: 0, // Prepend to the array
          },
        },
      }
    );

    if (updateResult.modifiedCount === 0) {
      return NextResponse.json(
        { message: "Failed to update order status" },
        { status: 500 }
      );
    }

    let pushArr = [
      {
        to: "ExponentPushToken[1rnrtrHQ8rfDecQlrnlxdH]",
        sound: "default",
        data: { updateOrderStatus: true, orderId: orderId, userId },
        priority: "high",
        title: "Order status updated successfully",
      },
      {
        to: "ExponentPushToken[1rnrtrHQ8rfDecQlrnlxdH]",
        sound: "default",
        data: { updateOrderStatus: true, orderId: orderId, userId },
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
        timestamp,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
