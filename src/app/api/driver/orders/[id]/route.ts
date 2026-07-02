import { NextResponse } from "next/server";
import { requireDriver } from "@/app/api/driver/requireDriver";
import {
  findDriverOrder,
  normalizeDriverOrder,
} from "@/app/api/driver/driverOrderUtils";

type RouteContext = { params: Promise<{ id: string }> };

function buildError(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export async function GET(req: Request, context: RouteContext) {
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

    return NextResponse.json(
      { order: normalizeDriverOrder(order as never) },
      { status: 200 },
    );
  } catch (error) {
    console.error("[driver/orders/:id] GET error:", error);
    return buildError("INTERNAL", "Failed to fetch order", 500);
  }
}
