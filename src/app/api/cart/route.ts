import { isTokenVerified } from "@/json";
import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";
import {
  commitTransaction,
  connectDB,
  getClient,
  startTransaction,
} from "../lib/dbconnection";

export async function PUT(req, res) {
  try {
    const { productId, productDetails, quantity } = await req.json();
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");

    if (
      !productId ||
      !ObjectId.isValid(productId) ||
      !productDetails ||
      quantity < 0 ||
      !userId
    ) {
      return NextResponse.json({ message: "Invalid input" }, { status: 400 });
    }

    const tokenVerificationResponse = await isTokenVerified(req);
    if (tokenVerificationResponse) {
      return tokenVerificationResponse;
    }
    let session;
    const db = await connectDB(req);
    const client = await getClient();
    session = await startTransaction(client);
    const userObjectId = new ObjectId(userId);
    const productObjectId = new ObjectId(productId);

    const cart = await db.collection("carts").findOne({ userId: userObjectId });

    if (!cart && quantity > 0) {
      // Cart doesn't exist, create a new one
      const product = await db
        .collection("products")
        .findOne({ _id: productObjectId });
      await db.collection("carts").insertOne({
        userId: userObjectId,
        items: [
          {
            productId: productObjectId,
            productDetails: product,
            quantity,
          },
        ],
      });
      await commitTransaction(session);
      return NextResponse.json(
        { message: "Product added to cart" },
        { status: 201 }
      );
    }

    const product = await db
      .collection("products")
      .findOne({ _id: productObjectId });

    if (cart) {
      const itemIndex = cart.items.findIndex((item) =>
        item.productId.equals(productObjectId)
      );

      let updateAction;
      if (itemIndex === -1 && quantity > 0) {
        // Product not in cart and quantity > 0, add it
        updateAction = {
          $push: {
            items: {
              productId: productObjectId,
              productDetails: product,
              quantity,
            },
          },
        };
      } else if (itemIndex !== -1 && quantity > 0) {
        // Product in cart and quantity > 0, update it
        updateAction = {
          $set: {
            [`items.${itemIndex}.quantity`]: quantity,
            [`items.${itemIndex}.productDetails`]: product,
          },
        };
      } else if (itemIndex !== -1 && quantity === 0) {
        // Quantity is 0, remove it from cart
        updateAction = { $pull: { items: { productId: productObjectId } } };
      } else {
        await commitTransaction(session);
        return NextResponse.json(
          { message: "Invalid operation" },
          { status: 400 }
        );
      }

      await db
        .collection("carts")
        .updateOne({ userId: userObjectId }, updateAction);

      console.log("Cart updated successfully", updateAction);
      await commitTransaction(session);
      return NextResponse.json(
        { message: "Cart updated successfully" },
        { status: 200 }
      );
    }
    await commitTransaction(session);
    return NextResponse.json(
      { message: "Product quantity must be greater than 0" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
let i = 0;
export async function GET(req, res) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");

    if (!userId || !ObjectId.isValid(userId)) {
      return NextResponse.json({ message: "Invalid user ID" }, { status: 400 });
    }

    const tokenVerificationResponse = await isTokenVerified(req);
    if (tokenVerificationResponse) {
      return tokenVerificationResponse;
    }

    const db = await connectDB(req);

    const cart = await db
      .collection("carts")
      .findOne({ userId: new ObjectId(userId) });
    i = i + 1;
    console.log("kiuy654567890-", i);
    // if (i >= 1) {
    // await new Promise((res) => {
    //   setTimeout(() => {
    //     res("hi");
    //   }, 5500);
    // });
    // }
    // await new Promise((res) => {
    //   setTimeout(() => {
    //     res("hi");
    //   }, 2000);
    // });

    if (!cart) {
      return NextResponse.json(
        { message: "Cart not found", cart: [] },
        { status: 404 }
      );
    }

    return NextResponse.json({ cart }, { status: 200 });
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
