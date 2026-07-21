import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "../../lib/dbconnection";
import { isTokenVerified } from "@/json";

export async function GET(req: NextRequest) {
  try {
    const tokenVerificationResponse = await isTokenVerified(req);
    if (tokenVerificationResponse) {
      return tokenVerificationResponse;
    }
    const { searchParams } = new URL(req.url);
    const orderId = searchParams.get("orderId");

    if (!orderId) {
      return NextResponse.json(
        { message: "Missing order ID" },
        { status: 400 },
      );
    }

    const db = await connectDB(req);

    const orderData = await db.collection("orders").findOne({
      orderId: orderId,
    });

    if (!orderData) {
      return NextResponse.json({ message: "Order not found" }, { status: 404 });
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
