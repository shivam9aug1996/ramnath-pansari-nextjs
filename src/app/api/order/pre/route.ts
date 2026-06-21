import { isTokenVerified } from "@/json";
import { NextRequest, NextResponse } from "next/server";
import { encode } from "js-base64";
import { validateCheckoutHoldsForPayment } from "@/app/api/utils/productPendingLock";
import { logError } from "@/app/api/lib/logger";

export async function POST(req: NextRequest) {
  if (req.method !== "POST") {
    return NextResponse.json(
      { message: "Method not allowed" },
      { status: 405 },
    );
  }

  try {
    const { amount, isLive = false, userId, productIds = [] } = await req.json();

    if (!amount || amount == 0) {
      return NextResponse.json(
        { message: "Pass correct value for the amount" },
        { status: 400 },
      );
    }

    const tokenVerificationResponse = await isTokenVerified(req);
    if (tokenVerificationResponse) {
      return tokenVerificationResponse;
    }

    if (userId && Array.isArray(productIds) && productIds.length > 0) {
      console.log("[product-lock] pre:validate:start", { userId, productIds });
      try {
        const holdResult = await validateCheckoutHoldsForPayment(
          userId,
          productIds,
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
        console.log("[product-lock] pre:validate:success", { userId, productIds });
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
      return NextResponse.json({ data: res }, { status: 200 });
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
