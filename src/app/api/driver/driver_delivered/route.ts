import { NextRequest, NextResponse } from "next/server";
import { asMongoUpdate } from "@/types/api";
import { syncActiveOrderToFirebase } from "../../utils/syncActiveOrderToFirebase";
import {
  MAX_DELIVERY_OTP_ATTEMPTS,
  otpMatches,
} from "@/app/api/utils/deliveryOtp";
import { requireDriver } from "@/app/api/driver/requireDriver";

export async function POST(req: NextRequest) {
  try {
    const auth = await requireDriver(req);
    if ("error" in auth) return auth.error;
    const { db, driverId: authDriverId } = auth;

    const { orderId, otp } = await req.json();
    if (!orderId) {
      return NextResponse.json(
        { message: "Missing required fields" },
        { status: 400 },
      );
    }
    const orders = db.collection("orders");
    const order = await orders.findOne({ orderId });
    if (!order) {
      return NextResponse.json({ message: "Order not found" }, { status: 404 });
    }
    if (["delivered", "canceled"].includes(order.orderStatus)) {
      return NextResponse.json(
        { message: `Cannot mark delivered. Order is ${order.orderStatus}` },
        { status: 400 },
      );
    }
    if (
      !order.assignedDriver ||
      order.assignedDriver.driverId !== authDriverId
    ) {
      return NextResponse.json(
        { message: "Driver not assigned to this order" },
        { status: 403 },
      );
    }

    const providedOtp = String(otp ?? "").trim();
    if (!/^\d{4}$/.test(providedOtp)) {
      return NextResponse.json(
        {
          error: {
            code: "INVALID_OTP",
            message: "Enter the 4-digit delivery OTP",
          },
        },
        { status: 400 },
      );
    }

    const attempts = Number(order.deliveryOtpAttempts ?? 0);
    if (attempts >= MAX_DELIVERY_OTP_ATTEMPTS) {
      return NextResponse.json(
        {
          error: {
            code: "OTP_LOCKED",
            message: "Too many incorrect OTP attempts. Contact support.",
          },
        },
        { status: 429 },
      );
    }

    if (!otpMatches(order.deliveryOtp, providedOtp)) {
      const nextAttempts = attempts + 1;
      await orders.updateOne(
        { orderId },
        asMongoUpdate({
          $set: { deliveryOtpAttempts: nextAttempts, updatedAt: new Date() },
        }),
      );
      return NextResponse.json(
        {
          error: {
            code:
              nextAttempts >= MAX_DELIVERY_OTP_ATTEMPTS
                ? "OTP_LOCKED"
                : "INVALID_OTP",
            message:
              nextAttempts >= MAX_DELIVERY_OTP_ATTEMPTS
                ? "Too many incorrect OTP attempts. Contact support."
                : `Incorrect OTP. ${MAX_DELIVERY_OTP_ATTEMPTS - nextAttempts} attempt(s) left.`,
          },
        },
        { status: nextAttempts >= MAX_DELIVERY_OTP_ATTEMPTS ? 429 : 400 },
      );
    }

    const now = new Date();
    await orders.updateOne(
      { orderId },
      asMongoUpdate({
        $set: {
          orderStatus: "delivered",
          driverTrackingStatus: "driver_delivered",
          updatedAt: now,
          deliveryOtp: null,
          deliveryOtpAttempts: 0,
        },
        $push: {
          driverTrackingHistory: {
            status: "driver_delivered",
            timestamp: now,
          },
          orderHistory: {
            status: "delivered",
            timestamp: now,
          },
        },
      }),
    );

    await syncActiveOrderToFirebase({
      userId: String(order.userId),
      mongoOrderId: order._id.toString(),
      orderId,
      status: "delivered",
      imgArr: order.imgArr,
      amountPaid: order.amountPaid,
      totalProductCount: order.totalProductCount,
      deliveryOtp: null,
    });

    return NextResponse.json(
      { message: "Order marked as delivered" },
      { status: 200 },
    );
  } catch (error) {
    console.error("Driver Delivered Error:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 },
    );
  }
}
