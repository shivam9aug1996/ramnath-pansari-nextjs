import { NextResponse } from "next/server";
import { requireDriver } from "@/app/api/driver/requireDriver";
import { normalizeDriverOrder } from "@/app/api/driver/driverOrderUtils";

function buildError(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export async function GET(req: Request) {
  const auth = await requireDriver(req);
  if ("error" in auth) return auth.error;

  const { db, driverId } = auth;

  try {
    const ordersRaw = await db
      .collection("orders")
      .find({
        isDeleted: { $ne: true },
        "assignedDriver.driverId": driverId,
        orderStatus: { $in: ["confirmed", "out_for_delivery"] },
      })
      .sort({ createdAt: -1 })
      .toArray();

    const orders = ordersRaw.map((o) => normalizeDriverOrder(o as never));

    const activeDelivery = orders.find(
      (o) => o.orderStatus === "out_for_delivery",
    );

    return NextResponse.json(
      {
        orders,
        activeDeliveryOrderId: activeDelivery?.orderId ?? null,
        driverId,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("[driver/orders] GET error:", error);
    return buildError("INTERNAL", "Failed to fetch driver orders", 500);
  }
}
