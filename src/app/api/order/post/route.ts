import { NextResponse } from "next/server"; // Assuming Next.js environment
import { ObjectId } from "mongodb"; // Ensure this is imported for ObjectId operations
import { isTokenVerified } from "@/json";
import { connectDB } from "../../lib/dbconnection";

export async function GET(req, res) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "10", 10);

    if (!userId) {
      return NextResponse.json({ message: "Missing user ID" }, { status: 400 });
    }

    // Verify token (example function, replace with your authentication logic)
    const tokenVerificationResponse = await isTokenVerified(req);
    if (tokenVerificationResponse) {
      return tokenVerificationResponse;
    }

    const db = await connectDB(req);

    // Calculate the number of documents to skip for pagination
    const skip = (page - 1) * limit;

    // Find orders by userId with pagination, only returning the needed fields
    const orders = await db
      .collection("orders")
      .find({ userId: userId })
      .skip(skip)
      .limit(limit)
      .project({
        // Only return necessary fields
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

    // Get the total count of orders for the user (for calculating total pages)
    const totalOrders = await db
      .collection("orders")
      .countDocuments({ userId: userId });

    const totalPages = Math.ceil(totalOrders / limit);

    return NextResponse.json(
      { orders, totalOrders, totalPages, currentPage: page },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
