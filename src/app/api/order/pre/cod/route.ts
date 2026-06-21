import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/app/api/lib/dbconnection";
import { isTokenVerified } from "@/json";
import { sendPushNotification } from "@/app/api/utils/sendPush";
import { CartItem } from "@/types/api";
import { OrderStatus } from "../../orderStatus";
import { syncActiveOrderToFirebase } from "@/app/api/utils/syncActiveOrderToFirebase";
import {
  calculateCartSubtotal,
  getDeliveryFee,
  getPayableAmountFromCart,
} from "@/app/api/utils/orderAmount";
import {
  commitOrderProductLocks,
  extractProductIdsFromCart,
  releaseProductLocksAfterFailedInsert,
} from "@/app/api/utils/productPendingLock";
import { logError } from "@/app/api/lib/logger";
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
      cartData,
      addressData,
      userId,
      isLive = false,
      amount,
    } = await req.json();

    console.log(cartData, addressData, userId, isLive);

    if (!cartData || !addressData || !userId || amount == null) {
      return NextResponse.json({ message: "Invalid input" }, { status: 400 });
    }

    const cartItems = cartData?.cart?.items ?? [];
    const subtotal = calculateCartSubtotal(cartItems);
    const deliveryFee = getDeliveryFee(subtotal);
    const expectedAmount = getPayableAmountFromCart(cartItems);

    if (Math.abs(Number(amount) - expectedAmount) > 0.01) {
      return NextResponse.json(
        {
          message: "Invalid order amount",
          expectedAmount,
          receivedAmount: amount,
        },
        { status: 400 },
      );
    }

    const db = await connectDB(req);

    const id = orderid.generate();
    const productIds = extractProductIdsFromCart(cartData);
    console.log("[product-lock] cod:start", { userId, orderId: id, productIds });

    let lockResult;
    try {
      lockResult = await commitOrderProductLocks(userId, id, productIds);
    } catch (error) {
      logError("[product-lock] cod:lock-error", error);
      return NextResponse.json(
        { error: "Failed to reserve products for order" },
        { status: 503 },
      );
    }

    if (!lockResult.ok) {
      console.log("[product-lock] cod:lock-failed", {
        userId,
        orderId: id,
        code: lockResult.code,
        heldProducts: lockResult.heldProducts,
      });
      return NextResponse.json(
        {
          message:
            lockResult.code === "HOLD_EXPIRED"
              ? "Checkout session expired. Go back to cart and try again."
              : "One or more items are on hold for another order.",
          code: lockResult.code,
          heldProducts: lockResult.heldProducts,
        },
        { status: 409 },
      );
    }

    const imgArr = storeImages(cartData.cart);

    const transactionData = {
      method: "COD",
      createdAt: new Date(),
      currency: "INR",
      isLive: isLive,
      amount: expectedAmount,
    };

    const totalProductCount = getTotalProductCount(cartData?.cart);
    const amountPaid = expectedAmount;

    let result;
    try {
      result = await db.collection("orders").insertOne({
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
        totalProductCount,
        orderHistory: [{ status: OrderStatus.CONFIRMED, timestamp: new Date() }],
        amountPaid,
        subtotal,
        deliveryFee,
      });
    } catch (error) {
      await releaseProductLocksAfterFailedInsert(id, productIds);
      logError("[product-lock] cod:insert-error", error);
      throw error;
    }

    console.log("[product-lock] cod:success", {
      userId,
      orderId: id,
      mongoOrderId: result.insertedId.toString(),
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
