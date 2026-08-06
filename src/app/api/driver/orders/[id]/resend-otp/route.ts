import { NextResponse } from "next/server";
import { requireDriver } from "@/app/api/driver/requireDriver";
import { findDriverOrder } from "@/app/api/driver/driverOrderUtils";
import { OrderStatus } from "@/app/api/order/orderStatus";
import { asMongoUpdate } from "@/types/api";
import {
  RESEND_OTP_COOLDOWN_MS,
  sendDeliveryOtpPush,
} from "@/app/api/utils/deliveryOtp";
import { syncActiveOrderToFirebase } from "@/app/api/utils/syncActiveOrderToFirebase";

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
    const order = await findDriverOrder(db, id);
    if (!order) {
      return buildError("NOT_FOUND", "Order not found", 404);
    }

    if (order.assignedDriver?.driverId !== driverId) {
      return buildError("FORBIDDEN", "This order is not assigned to you", 403);
    }

    const status = String(order.orderStatus ?? "").toLowerCase();
    if (status !== OrderStatus.OUT_FOR_DELIVERY) {
      return buildError(
        "BAD_REQUEST",
        "OTP can only be resent while out for delivery",
        400,
      );
    }

    const deliveryOtp = String(order.deliveryOtp ?? "");
    if (!/^\d{4}$/.test(deliveryOtp)) {
      return buildError(
        "BAD_REQUEST",
        "No delivery OTP on this order",
        400,
      );
    }

    const lastResendAt = order.deliveryOtpLastResendAt
      ? new Date(order.deliveryOtpLastResendAt).getTime()
      : 0;
    if (lastResendAt && Date.now() - lastResendAt < RESEND_OTP_COOLDOWN_MS) {
      const waitSec = Math.ceil(
        (RESEND_OTP_COOLDOWN_MS - (Date.now() - lastResendAt)) / 1000,
      );
      return buildError(
        "RATE_LIMITED",
        `Wait ${waitSec}s before resending OTP`,
        429,
      );
    }

    const now = new Date();
    await db.collection("orders").updateOne(
      { _id: order._id },
      asMongoUpdate({
        $set: {
          deliveryOtpLastResendAt: now,
          updatedAt: now,
        },
      }),
    );

    const mongoOrderId = String(order._id);
    const userId = String(order.userId);
    const humanOrderId = String(order.orderId);

    await syncActiveOrderToFirebase({
      userId,
      mongoOrderId,
      orderId: humanOrderId,
      status: OrderStatus.OUT_FOR_DELIVERY,
      imgArr: order.imgArr,
      amountPaid: order.amountPaid,
      totalProductCount: order.totalProductCount,
      deliveryOtp,
    });

    await sendDeliveryOtpPush({
      db,
      userId,
      mongoOrderId,
      humanOrderId,
      deliveryOtp,
    });

    return NextResponse.json(
      { message: "Delivery OTP sent to customer", orderId: order.orderId },
      { status: 200 },
    );
  } catch (error) {
    console.error("[driver/orders/:id/resend-otp] POST error:", error);
    return buildError("INTERNAL", "Failed to resend OTP", 500);
  }
}
