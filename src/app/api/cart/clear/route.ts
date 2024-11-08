import { isTokenVerified } from "@/json";
import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";
import { connectDB } from "../../lib/dbconnection";

export async function PUT(req, res) {
  let session;
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json({ message: "Invalid input" }, { status: 400 });
    }

    const tokenVerificationResponse = await isTokenVerified(req);
    if (tokenVerificationResponse) {
      return tokenVerificationResponse;
    }

    const db = await connectDB(req);

    const userObjectId = new ObjectId(userId);

    const cart = await db
      .collection("carts")
      .findOne({ userId: userObjectId }, { session });

    if (cart) {
      await db.collection("carts").updateOne(
        { userId: userObjectId },
        { $set: { items: [] } } // Set items to an empty array
      );

      return NextResponse.json(
        { message: "Cart is clear successfully" },
        { status: 200 }
      );
    } else {
      return NextResponse.json({ message: "Cart not exists" }, { status: 400 });
    }
  } catch (error) {
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
