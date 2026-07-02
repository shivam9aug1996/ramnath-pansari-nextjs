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
    if (status === OrderStatus.OUT_FOR_DELIVERY) {
      return NextResponse.json(
        {
          message: "Delivery already started",
          orderId: order.orderId,
          orderStatus: OrderStatus.OUT_FOR_DELIVERY,
        },
        { status: 200 },
      );
    }

    if (status !== OrderStatus.CONFIRMED) {
      return buildError(
        "BAD_REQUEST",
        `Cannot start delivery when order is ${status}`,
        400,
      );
    }

    const activeOther = await db.collection("orders").findOne({
      isDeleted: { $ne: true },
      "assignedDriver.driverId": driverId,
      orderStatus: OrderStatus.OUT_FOR_DELIVERY,
      orderId: { $ne: order.orderId },
    });

    if (activeOther) {
      return buildError(
        "CONFLICT",
        `Finish delivery for order #${activeOther.orderId} before starting another`,
        409,
      );
    }

    const lat = parseFloat(String(order.addressData?.latitude ?? ""));
    const lng = parseFloat(String(order.addressData?.longitude ?? ""));
    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      return buildError(
        "BAD_REQUEST",
        "Delivery address is missing map coordinates",
        400,
      );
    }

    const now = new Date();
    await db.collection("orders").updateOne(
      { _id: order._id },
      asMongoUpdate({
        $set: {
          driverTrackingStatus: "out_for_delivery",
          updatedAt: now,
        },
        $push: {
          driverTrackingHistory: {
            status: "out_for_delivery",
            timestamp: now,
          },
        },
      }),
    );

    await updateOrderStatus(
      db,
      String(order.orderId),
      OrderStatus.OUT_FOR_DELIVERY,
      String(order.userId),
    );

    return NextResponse.json(
      {
        message: "Delivery started",
        orderId: order.orderId,
        orderStatus: OrderStatus.OUT_FOR_DELIVERY,
        latitude: lat,
        longitude: lng,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("[driver/orders/:id/start] POST error:", error);
    return buildError("INTERNAL", "Failed to start delivery", 500);
  }
}
