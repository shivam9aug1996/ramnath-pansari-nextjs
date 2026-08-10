import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";

import { encode } from "js-base64";
import { connectDB } from "@/app/api/lib/dbconnection";
import { sendPushNotification } from "@/app/api/utils/sendPush";
import { sendAdminOrderPlacedEmail } from "@/app/api/utils/sendAdminOrderEmail";
import { CartItem } from "@/types/api";
import { OrderStatus } from "../../orderStatus";
import { syncActiveOrderToFirebase } from "@/app/api/utils/syncActiveOrderToFirebase";
import {
  generateDeliveryOtp,
  sendDeliveryOtpPush,
} from "@/app/api/utils/deliveryOtp";
import {
  calculateCartSubtotal,
  getDeliveryFee,
  getPayableAmountFromCart,
} from "@/app/api/utils/orderAmount";
import { applyOffersToCart } from "@/app/api/offers/applyOffers";
import { getDeliverySettings } from "@/app/api/delivery/deliverySettingsUtils";
import { getStoreConfig, validateOrderPlacement } from "@/app/api/store/storeConfigUtils";
import {
  commitOrderProductLocks,
  extractProductIdsFromCart,
  releaseProductLocksAfterFailedInsert,
} from "@/app/api/utils/productPendingLock";
import { logError } from "@/app/api/lib/logger";
import { requireSameUser } from "@/app/api/lib/requireAuth";
import {
  rehydrateCartItemsFromDb,
  sanitizeAddressData,
} from "@/app/api/utils/secureCart";
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

    const {
      razorpay_payment_id,
      razorpay_signature,
      isLive = false,
      order_id,
      cartData,
      addressData,
      userId: requestedUserId,
    } = await req.json();

    const auth = await requireSameUser(req, requestedUserId);
    if (auth instanceof NextResponse) return auth;
    const userId = auth.userId;

    const sanitizedAddress = sanitizeAddressData(addressData);
    if (!sanitizedAddress) {
      return NextResponse.json(
        { message: "Invalid address", verified: false },
        { status: 400 },
      );
    }

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
      const storeConfig = await getStoreConfig(db);
      const placementCheck = validateOrderPlacement(
        sanitizedAddress,
        storeConfig,
      );
      if (!placementCheck.ok) {
        return NextResponse.json(
          {
            message: placementCheck.message,
            code: placementCheck.code,
            verified: false,
          },
          { status: 400 },
        );
      }

      const rehydrated = await rehydrateCartItemsFromDb(
        db,
        cartData?.cart?.items ?? [],
      );
      if (!rehydrated.ok) {
        return NextResponse.json(
          {
            message: rehydrated.message,
            code: rehydrated.code,
            verified: false,
          },
          { status: 400 },
        );
      }

      const deliverySettings = await getDeliverySettings(db);
      const { items: cartItems, orderDiscount } = await applyOffersToCart(
        db,
        rehydrated.items,
      );
      const subtotal = calculateCartSubtotal(cartItems);
      const deliveryFee = getDeliveryFee(subtotal, deliverySettings);
      const expectedAmount = getPayableAmountFromCart(
        cartItems,
        deliverySettings,
        orderDiscount,
      );
      const amountPaid = (transactionData?.amount as number) || 0;

      if (Math.abs(amountPaid - expectedAmount) > 0.01) {
        return NextResponse.json(
          {
            message: "Paid amount does not match cart total",
            expectedAmount,
            amountPaid,
            verified: false,
          },
          { status: 400 },
        );
      }

      cartData.cart = {
        ...(cartData?.cart ?? {}),
        items: cartItems,
        userId: new ObjectId(userId),
      };
      cartData.orderDiscount = orderDiscount;

      const id = orderid.generate();
      const productIds = extractProductIdsFromCart(cartData);
      console.log("[product-lock] verify:start", {
        userId,
        orderId: id,
        productIds,
      });

      let lockResult;
      try {
        lockResult = await commitOrderProductLocks(userId, id, productIds);
      } catch (error) {
        logError("[product-lock] verify:lock-error", error);
        return NextResponse.json(
          { error: "Failed to reserve products for order", verified: false },
          { status: 503 },
        );
      }

      if (!lockResult.ok) {
        console.log("[product-lock] verify:lock-failed", {
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
            verified: false,
          },
          { status: 409 },
        );
      }

      let imgArr = storeImages(cartData.cart);
      const deliveryOtp = generateDeliveryOtp();

      const totalProductCount = getTotalProductCount(cartData?.cart);

      let result;
      try {
        result = await db.collection("orders").insertOne({
          transactionData,
          cartData,
          addressData: sanitizedAddress,
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
          orderDiscount,
          deliveryOtp,
          deliveryOtpAttempts: 0,
        });
      } catch (error) {
        await releaseProductLocksAfterFailedInsert(id, productIds);
        logError("[product-lock] verify:insert-error", error);
        throw error;
      }

      console.log("[product-lock] verify:success", {
        userId,
        orderId: id,
        mongoOrderId: result.insertedId.toString(),
      });

      const mongoOrderId = result.insertedId.toString();

      await syncActiveOrderToFirebase({
        userId,
        mongoOrderId,
        orderId: id,
        status: OrderStatus.CONFIRMED,
        imgArr,
        amountPaid,
        totalProductCount,
        deliveryOtp,
      });

      await sendDeliveryOtpPush({
        db,
        userId,
        mongoOrderId,
        humanOrderId: id,
        deliveryOtp,
      });

      await sendAdminOrderPlacedEmail({
        humanOrderId: id,
        mongoOrderId,
        paymentMethod: "ONLINE",
        amountPaid,
        subtotal,
        deliveryFee,
        userId: userId?.toString?.() ?? String(userId),
        addressData: sanitizedAddress,
        cartItems,
      });

      const admin = await db.collection("pushTokens").findOne({
        isAdminUser: true,
      });
      if (admin) {
        admin?.tokens?.forEach(async (token: { toString(): string }) => {
          await sendPushNotification({
            deviceToken: token?.toString(),
            orderId: mongoOrderId,
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
