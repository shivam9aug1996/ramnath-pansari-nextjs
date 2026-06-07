import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "../../lib/dbconnection";
import { asMongoUpdate } from "@/types/api";
export async function POST(req: NextRequest) {
  try {
    const { orderId, driver } = await req.json();
    if (!orderId || !driver?.driverId) {
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
    if (
      ["delivered", "canceled", "out_for_delivery"].includes(order.orderStatus)
    ) {
      return NextResponse.json(
        { message: `Cannot assign driver. Order is ${order.orderStatus}` },
        { status: 400 },
      );
    }
    if (order.driverTrackingStatus === "driver_picked_up") {
      return NextResponse.json(
        {
          message: "Cannot assign driver after order is picked up",
          status: "already_picked_up",
        },
        { status: 400 },
      );
    }
    const now = new Date();
    if (order.assignedDriver?.driverId === driver.driverId) {
      return NextResponse.json(
        { message: "Driver already assigned", alreadyAssigned: true },
        { status: 200 },
      );
    }
    const updates: Record<string, unknown> = {};
    if (order.assignedDriver) {
      const oldDriver = order.assignedDriver;
      updates.$push = {
        driverHistory: {
          driverId: oldDriver.driverId,
          name: oldDriver.name,
          phone: oldDriver.phone,
          assignedAt: oldDriver.assignedAt,
          unassignedAt: now,
          reason: "Reassigned to new driver",
        },
        driverTrackingHistory: {
          status: "unassigned",
          timestamp: now,
          reason: "Reassigned to new driver",
        },
      };
    } else {
      updates.$push = {
        driverTrackingHistory: {
          status: "driver_assigned",
          timestamp: now,
        },
      };
    }
    updates.$set = {
      assignedDriver: {
        driverId: driver.driverId,
        name: driver.name,
        phone: driver.phone,
        assignedAt: now,
      },
      driverTrackingStatus: "driver_assigned",
    };
    await orders.updateOne({ orderId }, asMongoUpdate(updates));
    return NextResponse.json(
      { message: "Driver assigned successfully" },
      { status: 200 },
    );
  } catch (error) {
    console.error("Assign Driver Error:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 },
    );
  }
}
