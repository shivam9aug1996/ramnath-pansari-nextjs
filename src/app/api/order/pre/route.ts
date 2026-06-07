import { isTokenVerified } from "@/json";
import { NextRequest, NextResponse } from "next/server";
import { encode } from "js-base64";

export async function POST(req: NextRequest) {
  if (req.method !== "POST") {
    return NextResponse.json(
      { message: "Method not allowed" },
      { status: 405 },
    );
  }

  try {
    const { amount, isLive = false } = await req.json();

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
