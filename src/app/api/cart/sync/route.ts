import { ObjectId } from "mongodb";
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "../../lib/dbconnection";
import { logError } from "../../lib/logger";
import { CartItem } from "@/types/api";

export async function PATCH(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");

    if (!userId || !ObjectId.isValid(userId)) {
      return NextResponse.json({ message: "Invalid user ID" }, { status: 400 });
    }

    const db = await connectDB(req);

    const cart = await db
      .collection("carts")
      .findOne({ userId: new ObjectId(userId) });

    if (!cart) {
      return NextResponse.json(
        { message: "Cart not found", cart: [] },
        { status: 404 },
      );
    }

    const updatedCartItems = (
      await Promise.all(
        cart.items.map(async (item: CartItem) => {
          const product = await db
            .collection("products")
            .findOne({ _id: new ObjectId(item.productId) });

          return product && !product.isOutOfStock
            ? {
                ...item,
                productDetails: product,
              }
            : null;
        }),
      )
    ).filter((item) => item !== null);

    await db
      .collection("carts")
      .updateOne(
        { userId: new ObjectId(userId) },
        { $set: { items: updatedCartItems } },
      );

    return NextResponse.json(
      { message: "Cart updated successfully", items: updatedCartItems },
      { status: 200 },
    );
  } catch (error) {
    logError("Error updating cart:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 },
    );
  }
}
