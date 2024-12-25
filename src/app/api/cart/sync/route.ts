import { isTokenVerified } from "@/json";
import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";
import { connectDB } from "../../lib/dbconnection";

export async function PATCH(req, res) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");

    if (!userId || !ObjectId.isValid(userId)) {
      return NextResponse.json({ message: "Invalid user ID" }, { status: 400 });
    }

    const db = await connectDB(req);

    // Fetch the user's cart
    const cart = await db
      .collection("carts")
      .findOne({ userId: new ObjectId(userId) });

    if (!cart) {
      return NextResponse.json(
        { message: "Cart not found", cart: [] },
        { status: 404 }
      );
    }

    // Fetch the latest product details
    // const updatedCartItems = await Promise.all(
    //   cart.items.map(async (item) => {
    //     const product = await db
    //       .collection("products")
    //       .findOne({ _id: new ObjectId(item.productId) });
    //     return {
    //       ...item,
    //       productDetails: product || item.productDetails, // Use existing details if the product is no longer available
    //     };
    //   })
    // );

    const updatedCartItems = (
      await Promise.all(
        cart.items.map(async (item) => {
          const product = await db
            .collection("products")
            .findOne({ _id: new ObjectId(item.productId) });

          // Return null if the product doesn't exist or is out of stock
          return product && !product.isOutOfStock
            ? {
                ...item,
                productDetails: product, // Update with latest product details
              }
            : null;
        })
      )
    ).filter((item) => item !== null);

    console.log("98765edfghjkl", updatedCartItems);

    // Update the cart in the database
    await db
      .collection("carts")
      .updateOne(
        { userId: new ObjectId(userId) },
        { $set: { items: updatedCartItems } }
      );

    return NextResponse.json(
      { message: "Cart updated successfully", items: updatedCartItems },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error updating cart:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
