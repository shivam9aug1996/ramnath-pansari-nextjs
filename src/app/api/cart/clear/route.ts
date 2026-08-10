import { ObjectId } from "mongodb";
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "../../lib/dbconnection";
import { requireSameUser } from "@/app/api/lib/requireAuth";
export async function PUT(req: NextRequest) {
  let session;
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");
    if (!userId) {
      return NextResponse.json({ message: "Invalid input" }, { status: 400 });
    }
    const auth = await requireSameUser(req, userId);
    if (auth instanceof NextResponse) return auth;
    const db = await connectDB(req);
    const userObjectId = new ObjectId(auth.userId);
    const cart = await db
      .collection("carts")
      .findOne({ userId: userObjectId }, { session });
    if (cart) {
      await db
        .collection("carts")
        .updateOne({ userId: userObjectId }, { $set: { items: [] } });
      return NextResponse.json(
        { message: "Cart is clear successfully" },
        { status: 200 },
      );
    } else {
      return NextResponse.json({ message: "Cart not exists" }, { status: 400 });
    }
  } catch (error) {
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 },
    );
  }
}
