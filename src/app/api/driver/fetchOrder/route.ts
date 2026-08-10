import { NextRequest, NextResponse } from "next/server";
import { requireDriver } from "@/app/api/driver/requireDriver";

export async function GET(req: NextRequest) {
  try {
    const auth = await requireDriver(req);
    if ("error" in auth) return auth.error;
    const { db, driverId } = auth;

    const { searchParams } = new URL(req.url);
    const orderId = searchParams.get("orderId");

    if (!orderId) {
      return NextResponse.json(
        { message: "Missing order ID" },
        { status: 400 },
      );
    }

    const orderData = await db.collection("orders").findOne({
      orderId: orderId,
    });

    if (!orderData) {
      return NextResponse.json({ message: "Order not found" }, { status: 404 });
    }

    if (orderData.assignedDriver?.driverId !== driverId) {
      return NextResponse.json(
        { message: "Driver not assigned to this order" },
        { status: 403 },
      );
    }

    return NextResponse.json(orderData, { status: 200 });
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 },
    );
  }
}
