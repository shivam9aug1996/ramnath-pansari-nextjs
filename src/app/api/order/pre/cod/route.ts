import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/app/api/lib/dbconnection";
import { isTokenVerified } from "@/json";
import { sendPushNotification } from "@/app/api/utils/sendPush";
const orderid = require("order-id")("key");

import { CartItem } from "@/types/api";

function storeImages(cart: { items?: CartItem[] }) {
  const images: string[] = [];

  cart?.items?.forEach((item: CartItem) => {
    const { productDetails } = item;
    const { image } = (productDetails ?? {}) as { image?: string };

    if (image) {
      if (images.length < 3) {
        images.push(image);
      }
    }
  });

  return images;
}

function getTotalProductCount(cart: { items?: CartItem[] }) {
  console.log("ytrdfghjk", cart);

  let total = 0;
  cart?.items?.forEach((item: CartItem) => {
    const { quantity = 0 } = item;
    console.log("ytredfghjkl", quantity, total, typeof quantity, typeof total);

    total = total + quantity;
  });
  console.log("uytrdfghjk", total);
  return total;
}

export const OrderStatus = {
  CONFIRMED: "confirmed",
  OUT_FOR_DELIVERY: "out_for_delivery",
  CANCELED: "canceled",
  DELIVERED: "delivered",
};

export async function POST(req: NextRequest) {
  try {
    if (req.method !== "POST") {
      return NextResponse.json(
        { message: "Method not allowed" },
        { status: 405 },
      );
    }

    const tokenVerificationResponse = await isTokenVerified(req);
    if (tokenVerificationResponse) {
      return tokenVerificationResponse;
    }

    const {
      cartData,
      addressData,
      userId,
      isLive = false,
      amount,
    } = await req.json();

    console.log(cartData, addressData, userId, isLive);

    if (!cartData || !addressData || !userId || !amount) {
      return NextResponse.json({ message: "Invalid input" }, { status: 400 });
    }

    const db = await connectDB(req);

    const id = orderid.generate();

    const imgArr = storeImages(cartData.cart);

    const transactionData = {
      method: "COD",
      createdAt: new Date(),
      currency: "INR",
      isLive: isLive,
      amount: amount,
    };

    const result = await db.collection("orders").insertOne({
      transactionData,
      cartData,
      addressData,
      orderStatus: OrderStatus.CONFIRMED,
      createdAt: new Date(),
      updatedAt: new Date(),
      orderId: id,
      userId,
      imgArr,
      productCount: cartData?.cart?.items?.length || 0,
      totalProductCount: getTotalProductCount(cartData?.cart),
      orderHistory: [{ status: OrderStatus.CONFIRMED, timestamp: new Date() }],
      amountPaid: transactionData?.amount || 0,
    });

    const admin = await db.collection("pushTokens").findOne({
      isAdminUser: true,
    });
    console.log("admin34567890", admin);
    if (admin) {
      admin?.tokens?.forEach(async (token: { toString(): string }) => {
        await sendPushNotification({
          deviceToken: token?.toString(),
          orderId: result?.insertedId?.toString(),
          userId: admin?.userId,
        });
      });
    }
    return NextResponse.json(
      {
        message: "Order placed successfully",
        orderId: result?.insertedId,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 },
    );
  }
}
