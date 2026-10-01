import { NextRequest, NextResponse } from "next/server";

import { connectDB } from "@/app/api/lib/dbconnection";
import { enforceRateLimit, getClientIp } from "@/app/api/lib/rateLimit";
import { logError } from "@/app/api/lib/logger";
import {
  createAndSendLoginOtp,
  isReservedLoginMobile,
  normalizeMobileNumber,
} from "@/app/api/auth/smsOtpUtils";

export async function POST(req: NextRequest) {
  try {
    const limitedIp = await enforceRateLimit(
      req,
      "smsOtpSendIp",
      getClientIp(req),
    );
    if (limitedIp) return limitedIp;

    const body = await req.json().catch(() => null);
    const mobileNumber = normalizeMobileNumber(
      body?.mobileNumber ?? body?.mobile ?? body?.numbers,
    );

    if (!mobileNumber) {
      return NextResponse.json(
        { message: "Enter a valid 10-digit mobile number" },
        { status: 400 },
      );
    }

    if (isReservedLoginMobile(mobileNumber)) {
      return NextResponse.json(
        { message: "This number cannot use SMS login" },
        { status: 400 },
      );
    }

    const limitedMobile = await enforceRateLimit(
      req,
      "smsOtpSendMobile",
      mobileNumber,
    );
    if (limitedMobile) return limitedMobile;

    const db = await connectDB(req);
    const result = await createAndSendLoginOtp(db, mobileNumber);

    if (!result.ok) {
      const message =
        result.code === "hourly_cap"
          ? "Too many OTP requests. Try again later."
          : "Please wait before requesting another OTP";
      return NextResponse.json(
        {
          message,
          code: result.code,
          retryAfterSeconds: result.retryAfterSeconds,
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(result.retryAfterSeconds),
          },
        },
      );
    }

    return NextResponse.json(
      {
        message: "OTP sent successfully",
        mobileNumber,
        expiresInSeconds: 300,
        resendCooldownSeconds: 45,
      },
      { status: 200 },
    );
  } catch (error) {
    logError("sms-otp/send failed", error);
    return NextResponse.json(
      { message: "Couldn't send OTP. Try again." },
      { status: 500 },
    );
  }
}
