import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "../../../lib/dbconnection";
import { ObjectId } from "mongodb";
import { logError } from "../../../lib/logger";
import { requireSameUser } from "@/app/api/lib/requireAuth";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");
    const orderId = searchParams.get("orderId");

    if (!userId) {
      return NextResponse.json({ message: "Missing user ID" }, { status: 400 });
    }
    if (!orderId) {
      return NextResponse.json(
        { message: "Missing order ID" },
        { status: 400 },
      );
    }

    const auth = await requireSameUser(req, userId);
    if (auth instanceof NextResponse) return auth;

    const db = await connectDB(req);

    const orderData = await db.collection("orders").findOne({
      userId: auth.userId,
      _id: new ObjectId(orderId),
    });

    if (!orderData) {
      return NextResponse.json({ message: "Order not found" }, { status: 404 });
    }

    return NextResponse.json({ orderData }, { status: 200 });
  } catch (error) {
    logError("Error:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 },
    );
  }
}
