import { NextResponse } from "next/server";
import { requireDriver } from "@/app/api/driver/requireDriver";
import { findDriverOrder } from "@/app/api/driver/driverOrderUtils";
import { updateOrderStatus } from "@/app/api/utils/updateOrderStatus";
import { OrderStatus } from "@/app/api/order/orderStatus";
import { asMongoUpdate } from "@/types/api";
import {
  MAX_DELIVERY_OTP_ATTEMPTS,
  otpMatches,
} from "@/app/api/utils/deliveryOtp";

type RouteContext = { params: Promise<{ id: string }> };

function buildError(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export async function POST(req: Request, context: RouteContext) {
  const auth = await requireDriver(req);
  if ("error" in auth) return auth.error;

  const { db, driverId } = auth;
  const { id } = await context.params;

  try {
    let body: { otp?: string } = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const otp = String(body?.otp ?? "").trim();
    if (!/^\d{4}$/.test(otp)) {
      return buildError("INVALID_OTP", "Enter the 4-digit delivery OTP", 400);
    }

    const order = await findDriverOrder(db, id);
    if (!order) {
      return buildError("NOT_FOUND", "Order not found", 404);
    }

    if (order.assignedDriver?.driverId !== driverId) {
      return buildError("FORBIDDEN", "This order is not assigned to you", 403);
    }

    const status = String(order.orderStatus ?? "").toLowerCase();
    if (status === OrderStatus.DELIVERED) {
      return NextResponse.json(
        { message: "Order already delivered", orderId: order.orderId },
        { status: 200 },
      );
    }

    if (status !== OrderStatus.OUT_FOR_DELIVERY) {
      return buildError(
        "BAD_REQUEST",
        "Start delivery before marking as delivered",
        400,
      );
    }

    const attempts = Number(order.deliveryOtpAttempts ?? 0);
    if (attempts >= MAX_DELIVERY_OTP_ATTEMPTS) {
      return buildError(
        "OTP_LOCKED",
        "Too many incorrect OTP attempts. Contact support.",
        429,
      );
    }

    if (!/^\d{4}$/.test(String(order.deliveryOtp ?? ""))) {
      return buildError(
        "BAD_REQUEST",
        "No delivery OTP on this order. Ask support to regenerate.",
        400,
      );
    }

    if (!otpMatches(order.deliveryOtp, otp)) {
      const nextAttempts = attempts + 1;
      await db.collection("orders").updateOne(
        { _id: order._id },
        asMongoUpdate({
          $set: {
            deliveryOtpAttempts: nextAttempts,
            updatedAt: new Date(),
          },
        }),
      );

      if (nextAttempts >= MAX_DELIVERY_OTP_ATTEMPTS) {
        return buildError(
          "OTP_LOCKED",
          "Too many incorrect OTP attempts. Contact support.",
          429,
        );
      }

      return buildError(
        "INVALID_OTP",
        `Incorrect OTP. ${MAX_DELIVERY_OTP_ATTEMPTS - nextAttempts} attempt(s) left.`,
        400,
      );
    }

    const now = new Date();
    await db.collection("orders").updateOne(
      { _id: order._id },
      asMongoUpdate({
        $set: {
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
        },
      }),
    );

    await updateOrderStatus(
      db,
      String(order.orderId),
      OrderStatus.DELIVERED,
      String(order.userId),
    );

    return NextResponse.json(
      {
        message: "Order marked as delivered",
        orderId: order.orderId,
        orderStatus: OrderStatus.DELIVERED,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("[driver/orders/:id/deliver] POST error:", error);
    return buildError("INTERNAL", "Failed to mark order delivered", 500);
  }
}
