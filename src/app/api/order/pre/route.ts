import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { encode } from "js-base64";
import { connectDB } from "@/app/api/lib/dbconnection";
import { validateCheckoutHoldsForPayment } from "@/app/api/utils/productPendingLock";
import { logError } from "@/app/api/lib/logger";
import { requireSameUser } from "@/app/api/lib/requireAuth";
import { rehydrateCartItemsFromDb } from "@/app/api/utils/secureCart";
import { applyOffersToCart } from "@/app/api/offers/applyOffers";
import { getDeliverySettings } from "@/app/api/delivery/deliverySettingsUtils";
import { getPayableAmountFromCart } from "@/app/api/utils/orderAmount";

export async function POST(req: NextRequest) {
  if (req.method !== "POST") {
    return NextResponse.json(
      { message: "Method not allowed" },
      { status: 405 },
    );
  }

  try {
    const {
      amount: clientAmount,
      isLive = false,
      userId: requestedUserId,
      productIds = [],
    } = await req.json();

    if (!requestedUserId) {
      return NextResponse.json(
        { message: "Missing userId" },
        { status: 400 },
      );
    }

    const auth = await requireSameUser(req, requestedUserId);
    if (auth instanceof NextResponse) return auth;
    const userId = auth.userId;

    const db = await connectDB(req);
    const cart = await db
      .collection("carts")
      .findOne({ userId: new ObjectId(userId) });

    const cartItems = (cart?.items as unknown[]) ?? [];
    const rehydrated = await rehydrateCartItemsFromDb(
      db,
      cartItems as import("@/types/api").CartItem[],
    );
    if (!rehydrated.ok) {
      return NextResponse.json(
        { message: rehydrated.message, code: rehydrated.code },
        { status: 400 },
      );
    }

    const deliverySettings = await getDeliverySettings(db);
    const { items, orderDiscount } = await applyOffersToCart(
      db,
      rehydrated.items,
    );
    const amount = getPayableAmountFromCart(
      items,
      deliverySettings,
      orderDiscount,
    );

    if (!amount || amount <= 0) {
      return NextResponse.json(
        { message: "Pass correct value for the amount" },
        { status: 400 },
      );
    }

    // Soft check: client amount may drift; server amount always wins for Razorpay.
    if (
      clientAmount != null &&
      Math.abs(Number(clientAmount) - amount) > 0.01
    ) {
      console.log("[order/pre] amount drift; using server amount", {
        clientAmount,
        amount,
        userId,
      });
    }

    const holdProductIds =
      Array.isArray(productIds) && productIds.length > 0
        ? productIds
        : rehydrated.items.map((item) => item.productId.toString());

    if (holdProductIds.length > 0) {
      console.log("[product-lock] pre:validate:start", {
        userId,
        productIds: holdProductIds,
      });
      try {
        const holdResult = await validateCheckoutHoldsForPayment(
          userId,
          holdProductIds,
        );
        if (!holdResult.ok) {
          console.log("[product-lock] pre:validate:failed", {
            userId,
            heldProducts: holdResult.heldProducts,
          });
          return NextResponse.json(
            {
              message:
                "Checkout session expired or items are on hold. Go back to cart and try again.",
              code: "ITEMS_ON_HOLD",
              heldProducts: holdResult.heldProducts,
            },
            { status: 409 },
          );
        }
        console.log("[product-lock] pre:validate:success", {
          userId,
          productIds: holdProductIds,
        });
      } catch (error) {
        logError("[product-lock] pre:validate:error", error);
        return NextResponse.json(
          { error: "Failed to validate checkout holds" },
          { status: 503 },
        );
      }
    }

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

    let res: any = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: Math.round(amount * 100),
        currency: "INR",
      }),
    });

    res = await res.json();
    console.log(res);

    if (res?.id) {
      return NextResponse.json(
        { data: res, expectedAmount: amount },
        { status: 200 },
      );
    } else {
      console.log("ytdfghj", res?.error);
      return NextResponse.json(
        { error: res?.error?.description },
        { status: 500 },
      );
    }
  } catch (error) {
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 },
    );
  }
}
