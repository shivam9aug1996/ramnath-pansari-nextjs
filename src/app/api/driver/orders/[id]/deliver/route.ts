import { NextResponse } from "next/server";
import { requireDriver } from "@/app/api/driver/requireDriver";
import { findDriverOrder } from "@/app/api/driver/driverOrderUtils";
import { updateOrderStatus } from "@/app/api/utils/updateOrderStatus";
import { OrderStatus } from "@/app/api/order/orderStatus";
import { asMongoUpdate } from "@/types/api";

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

    const now = new Date();
    await db.collection("orders").updateOne(
      { _id: order._id },
      asMongoUpdate({
        $set: {
          driverTrackingStatus: "driver_delivered",
          updatedAt: now,
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
