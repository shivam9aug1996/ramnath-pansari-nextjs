import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
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
import {
  getStoreConfig,
  validateOrderPlacement,
} from "@/app/api/store/storeConfigUtils";
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
  let total = 0;
  cart?.items?.forEach((item: CartItem) => {
    const { quantity = 0 } = item;
    total = total + quantity;
  });
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
      cartData,
      addressData,
      userId: requestedUserId,
      isLive = false,
      amount,
    } = await req.json();

    if (!cartData || !addressData || !requestedUserId || amount == null) {
      return NextResponse.json({ message: "Invalid input" }, { status: 400 });
    }

    const auth = await requireSameUser(req, requestedUserId);
    if (auth instanceof NextResponse) return auth;
    const userId = auth.userId;

    const sanitizedAddress = sanitizeAddressData(addressData);
    if (!sanitizedAddress) {
      return NextResponse.json({ message: "Invalid address" }, { status: 400 });
    }

    const incomingItems = cartData?.cart?.items ?? [];
    const db = await connectDB(req);
    const deliverySettings = await getDeliverySettings(db);
    const storeConfig = await getStoreConfig(db);

    const placementCheck = validateOrderPlacement(
      sanitizedAddress,
      storeConfig,
    );
    if (!placementCheck.ok) {
      return NextResponse.json(
        { message: placementCheck.message, code: placementCheck.code },
        { status: 400 },
      );
    }

    const rehydrated = await rehydrateCartItemsFromDb(db, incomingItems);
    if (!rehydrated.ok) {
      return NextResponse.json(
        { message: rehydrated.message, code: rehydrated.code },
        { status: 400 },
      );
    }

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

    cartData.cart = {
      ...(cartData.cart ?? {}),
      items: cartItems,
      userId: new ObjectId(userId),
    };
    cartData.orderDiscount = orderDiscount;

    if (Math.abs(Number(amount) - expectedAmount) > 0.01) {
      return NextResponse.json(
        {
          message: "Invalid order amount",
          expectedAmount,
          receivedAmount: amount,
          orderDiscount,
        },
        { status: 400 },
      );
    }

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
    const deliveryOtp = generateDeliveryOtp();

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
        addressData: sanitizedAddress,
        orderStatus: OrderStatus.CONFIRMED,
        createdAt: new Date(),
        updatedAt: new Date(),
        orderId: id,
        userId,
        imgArr,
        productCount: cartData?.cart?.items?.length || 0,
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
      logError("[product-lock] cod:insert-error", error);
      throw error;
    }

    console.log("[product-lock] cod:success", {
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
      paymentMethod: "COD",
      amountPaid,
      subtotal,
      deliveryFee,
      userId: userId?.toString?.() ?? String(userId),
      addressData: sanitizedAddress,
      cartItems: cartData?.cart?.items ?? [],
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
