import { NextResponse } from "next/server";
import { connectDB } from "../../lib/dbconnection";
export async function POST(req: Request) {
  try {
    const { driverId, orderStatus } = await req.json();
    if (!driverId) {
      return NextResponse.json(
        { message: "Missing driverId" },
        { status: 400 },
      );
    }
    const db = await connectDB();
    const orders = db.collection("orders");
    const filter: any = {
      "assignedDriver.driverId": driverId,
    };
    if (orderStatus) {
      filter.orderStatus = orderStatus;
    } else {
      filter.orderStatus = { $nin: ["delivered", "canceled"] };
    }
    const assignedOrders = await orders
      .find(filter)
      .sort({ createdAt: -1 })
      .toArray();
    return NextResponse.json({ orders: assignedOrders }, { status: 200 });
  } catch (error) {
    console.error("Fetch Driver Orders Error:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 },
    );
  }
}
