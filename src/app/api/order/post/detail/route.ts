import { NextResponse } from "next/server"; // Assuming Next.js environment
import { isTokenVerified } from "@/json";
import { connectDB } from "../../../lib/dbconnection";
import { ObjectId } from "mongodb";

export async function GET(req, res) {
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
        { status: 400 }
      );
    }

    // Verify token (example function, replace with your authentication logic)
    const tokenVerificationResponse = await isTokenVerified(req);
    if (tokenVerificationResponse) {
      return tokenVerificationResponse;
    }

    const db = await connectDB(req);

    const orderData = await db.collection("orders").findOne({
      userId: userId,
      _id: new ObjectId(orderId),
    });
    console.log("jhgfdsdfghjkl", userId, orderId);

    if (!orderData) {
      return NextResponse.json({ message: "Order not found" }, { status: 404 });
    }

    return NextResponse.json({ orderData }, { status: 200 });
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
