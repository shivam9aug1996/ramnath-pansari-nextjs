import { NextRequest, NextResponse } from "next/server";
import { isTokenVerified } from "@/json";
import { connectDB } from "../../lib/dbconnection";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "10", 10);

    if (!userId) {
      return NextResponse.json({ message: "Missing user ID" }, { status: 400 });
    }

    const tokenVerificationResponse = await isTokenVerified(req);
    if (tokenVerificationResponse) {
      return tokenVerificationResponse;
    }

    const db = await connectDB(req);

    const skip = (page - 1) * limit;

    const orders = await db
      .collection("orders")
      .find({ userId: userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .project({
        orderStatus: 1,
        createdAt: 1,
        updatedAt: 1,
        imgArr: 1,
        productCount: 1,
        totalProductCount: 1,
        orderHistory: 1,
        amountPaid: 1,
      })
      .toArray();

    const totalOrders = await db
      .collection("orders")
      .countDocuments({ userId: userId });

    const totalPages = Math.ceil(totalOrders / limit);

    return NextResponse.json(
      { orders, totalOrders, totalPages, currentPage: page },
      { status: 200 },
    );
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 },
    );
  }
}
