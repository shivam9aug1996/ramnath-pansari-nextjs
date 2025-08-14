import { NextResponse } from "next/server";
import { connectDB } from "@/app/api/lib/dbconnection";
import { isTokenVerified } from "@/json";
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
    // send push notification to admin
    const admin = await db.collection("pushTokens").findOne({
      isAdminUser: true,
    });
    console.log("admin34567890", admin);
    if (admin) {
      admin?.tokens?.forEach(async (token) => {
        await sendPushNotification({deviceToken: token?.toString(),orderId: result?.insertedId?.toString(),userId: admin?.userId});
      });
      
    }
    return NextResponse.json(
      {
        message: "Order placed successfully",
        orderId: result?.insertedId,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
