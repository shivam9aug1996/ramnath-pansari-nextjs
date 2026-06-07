import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "../../lib/dbconnection";
import { asMongoUpdate } from "@/types/api";
export async function POST(req: NextRequest) {
  try {
    const { orderId, driverId } = await req.json();
    if (!orderId || !driverId) {
      return NextResponse.json(
        { message: "Missing required fields" },
        { status: 400 },
      );
    }
    const db = await connectDB();
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
    if (!order.assignedDriver || order.assignedDriver.driverId !== driverId) {
      return NextResponse.json(
        { message: "Driver not assigned to this order" },
        { status: 403 },
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
