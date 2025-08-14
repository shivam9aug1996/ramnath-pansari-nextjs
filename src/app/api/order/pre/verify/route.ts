import { NextResponse } from "next/server";

import { isTokenVerified } from "@/json";
import { encode } from "js-base64";
import { connectDB } from "@/app/api/lib/dbconnection";
import { sendPushNotification } from "@/app/api/utils/sendPush";
const orderid = require("order-id")("key");

function storeImages(cart) {
  const images = [];

  // Iterate over each item in the cart
  cart?.items?.forEach((item) => {
    const { productDetails, quantity } = item;
    const { image } = productDetails;

    if (image) {
      if (images.length < 3) {
        images.push(image);
      }
    }
  });

  return images;
}

function getTotalProductCount(cart) {
  console.log("ytrdfghjk", cart);
  // Iterate over each item in the cart
  let total = 0;
  cart?.items?.forEach((item) => {
    const { quantity = 0 } = item;
    console.log("ytredfghjkl", quantity, total, typeof quantity, typeof total);
    // Store the image 'quantity' number of times or null if there's no image
    total = total + quantity;
    // for (let i = 0; i < quantity; i++) {
    //   total = total + quantity;
    // }
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
export async function POST(req, res) {
  try {
    if (req.method !== "POST") {
      return NextResponse.json(
        { message: "Method not allowed" },
        { status: 405 }
      );
    }

    const tokenVerificationResponse = await isTokenVerified(req);
    if (tokenVerificationResponse) {
      return tokenVerificationResponse;
    }

    const {
      razorpay_payment_id,
      razorpay_order_id,
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
      secretKey
    );

    if (isPaymentVerified) {
      let credentials;
      if (isLive) {
        credentials = encode(
          `${process.env.RAZORPAY_KEY_LIVE}:${process.env.RAZORPAY_SECRET_LIVE}`
        );
      } else {
        credentials = encode(
          `${process.env.RAZORPAY_KEY}:${process.env.RAZORPAY_SECRET}`
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
        }
      );

      res = await res.json();
      console.log("LKUYTR4567890-=", res);
      let transactionData = {};
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
        totalProductCount: getTotalProductCount(cartData?.cart),
        orderHistory: [
          { status: OrderStatus.CONFIRMED, timestamp: new Date() },
        ],
        amountPaid: transactionData?.amount || 0,
      });

      const admin = await db.collection("pushTokens").findOne({
        isAdminUser: true,
      });
      if (admin) {
        admin?.tokens?.forEach(async (token) => {
          await sendPushNotification({deviceToken: token?.toString(),orderId: result?.insertedId?.toString(),userId: admin?.userId});
        });
      }

      //create order
      return NextResponse.json(
        {
          message: "Payment successful",
          verified: true,
          orderId: result?.insertedId,
        },
        { status: 200 }
      );
    } else {
      return NextResponse.json(
        { message: "Try again", verified: false },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
