import { NextResponse } from "next/server";

import { isTokenVerified } from "@/json";

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
      return NextResponse.json(
        { message: "Payment successful", verified: true },
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
