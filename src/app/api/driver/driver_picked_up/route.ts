import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "../../lib/dbconnection";
import { updateOrderStatus } from "../../utils/updateOrderStatus";
import { asMongoUpdate } from "@/types/api";
export async function POST(req: NextRequest) {
  try {
    const { orderId, driverId } = await req.json();
    if (!orderId || !driverId) {
      return NextResponse.json(
        { message: "Missing orderId or driverId" },
        { status: 400 },
      );
    }
    const db = await connectDB();
    const orders = db.collection("orders");
    const order = await orders.findOne({ orderId });
    if (!order) {
      return NextResponse.json({ message: "Order not found" }, { status: 404 });
    }
    if (["canceled", "delivered"].includes(order.orderStatus)) {
      return NextResponse.json(
        {
          message: `Cannot update order. Current status is ${order.orderStatus}`,
        },
        { status: 400 },
      );
    }
    if (!order.assignedDriver) {
      return NextResponse.json(
        { message: "No driver assigned to this order" },
        { status: 400 },
      );
    }
    if (order.assignedDriver.driverId !== driverId) {
      return NextResponse.json(
        { message: "This driver is not assigned to the order" },
        { status: 403 },
      );
    }
    if (order.driverTrackingStatus === "driver_picked_up") {
      return NextResponse.json(
        { message: "Order already marked as picked up" },
        { status: 400 },
      );
    }
    const now = new Date();
    const updateDoc = {
      $set: {
        driverTrackingStatus: "driver_picked_up",
        updatedAt: now,
      },
      $push: {
        driverTrackingHistory: {
          status: "driver_picked_up",
          timestamp: now,
        },
      },
    };
    await orders.updateOne({ orderId }, asMongoUpdate(updateDoc));
    await updateOrderStatus(db, orderId, "out_for_delivery", order.userId);
    return NextResponse.json(
      { message: "Order marked as picked up successfully" },
      { status: 200 },
    );
  } catch (error) {
    console.error("Driver Picked Up Error:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 },
    );
  }
}
