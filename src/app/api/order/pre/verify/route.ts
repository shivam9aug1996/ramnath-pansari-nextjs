import { NextRequest, NextResponse } from "next/server";

import { isTokenVerified } from "@/json";
import { encode } from "js-base64";
import { connectDB } from "@/app/api/lib/dbconnection";
import { sendPushNotification } from "@/app/api/utils/sendPush";
import { CartItem } from "@/types/api";
import { OrderStatus } from "../../orderStatus";
import { syncActiveOrderToFirebase } from "@/app/api/utils/syncActiveOrderToFirebase";
import {
  calculateCartSubtotal,
  getDeliveryFee,
} from "@/app/api/utils/orderAmount";
const orderid = require("order-id")("key");

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
      razorpay_payment_id,
      razorpay_signature,
      isLive = false,
      order_id,
      cartData,
      addressData,
      userId,
    } = await req.json();

    const secretKey = isLive
      ? process.env.RAZORPAY_SECRET_LIVE
      : process.env.RAZORPAY_SECRET;

    var {
      validatePaymentVerification,
    } = require("../../../../../../node_modules/razorpay/dist/utils/razorpay-utils");

    const isPaymentVerified = validatePaymentVerification(
      { order_id: order_id, payment_id: razorpay_payment_id },
      razorpay_signature,
      secretKey,
    );

    if (isPaymentVerified) {
      let credentials;
      if (isLive) {
        credentials = encode(
          `${process.env.RAZORPAY_KEY_LIVE}:${process.env.RAZORPAY_SECRET_LIVE}`,
        );
      } else {
        credentials = encode(
          `${process.env.RAZORPAY_KEY}:${process.env.RAZORPAY_SECRET}`,
        );
      }

      let res: any = await fetch(
        `https://api.razorpay.com/v1/payments/${razorpay_payment_id}`,
        {
          method: "GET",
          headers: {
            Authorization: `Basic ${credentials}`,
            "Content-Type": "application/json",
          },
        },
      );

      res = await res.json();
      console.log("LKUYTR4567890-=", res);
      let transactionData: Record<string, unknown> = {};
      if (res?.id && res?.method) {
        transactionData.method = res?.method;
        transactionData.id = res?.id;
        transactionData.bank = res?.bank;
        transactionData.wallet = res?.wallet;
        transactionData.vpa = res?.vpa;
        transactionData.acquirerData = res?.acquirer_data;
        transactionData.orderId = res?.order_id;
        transactionData.createdAt = res?.created_at;
        transactionData.amount = res?.amount / 100;
        transactionData.currency = res?.currency;
        transactionData.isLive = isLive;
      }
      const db = await connectDB(req);
      const id = orderid.generate();

      let imgArr = storeImages(cartData.cart);

      const totalProductCount = getTotalProductCount(cartData?.cart);
      const cartItems = cartData?.cart?.items ?? [];
      const subtotal = calculateCartSubtotal(cartItems);
      const deliveryFee = getDeliveryFee(subtotal);
      const amountPaid = (transactionData?.amount as number) || 0;

      let result = await db.collection("orders").insertOne({
        transactionData,
        cartData,
        addressData,
        orderStatus: OrderStatus.CONFIRMED,
        createdAt: new Date(),
        updatedAt: new Date(),
        orderId: id,
        userId,
        imgArr,
        productCount: cartData?.cart?.items?.length,
        totalProductCount,
        orderHistory: [
          { status: OrderStatus.CONFIRMED, timestamp: new Date() },
        ],
        amountPaid,
        subtotal,
        deliveryFee,
      });

      await syncActiveOrderToFirebase({
        userId,
        mongoOrderId: result.insertedId.toString(),
        orderId: id,
        status: OrderStatus.CONFIRMED,
        imgArr,
        amountPaid,
        totalProductCount,
      });

      const admin = await db.collection("pushTokens").findOne({
        isAdminUser: true,
      });
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
          message: "Payment successful",
          verified: true,
          orderId: result?.insertedId,
        },
        { status: 200 },
      );
    } else {
      return NextResponse.json(
        { message: "Try again", verified: false },
        { status: 400 },
      );
    }
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 },
    );
  }
}
