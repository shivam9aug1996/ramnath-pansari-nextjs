import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "../../lib/dbconnection";
import {
  createAndSendAdminOtp,
  isAdminLoginAttempt,
} from "../adminOtpUtils";
import { logError } from "../../lib/logger";

export async function POST(req: NextRequest) {
  if (req.method !== "POST") {
    return NextResponse.json(
      { message: "Method not allowed" },
      { status: 405 },
    );
  }

  try {
    const { mobileNumber } = await req.json();

    if (!mobileNumber) {
      return NextResponse.json(
        { message: "Missing mobile number" },
        { status: 400 },
      );
    }

    const db = await connectDB(req);
    const user = await db.collection("users").findOne({ mobileNumber });

    if (isAdminLoginAttempt(mobileNumber, user)) {
      try {
        const { otpSentTo } = await createAndSendAdminOtp(db, mobileNumber);
        return NextResponse.json(
          {
            userAlreadyRegistered: true,
            message: "OTP sent successfully",
            requiresEmailOtp: true,
            otpSentTo,
          },
          { status: 200 },
        );
      } catch (error) {
        logError("sendOtp admin email failed", error);
        return NextResponse.json(
          { error: "Failed to send admin OTP email" },
          { status: 500 },
        );
      }
    }

    return NextResponse.json(
      {
        userAlreadyRegistered: !!user,
        message: "OTP sent successfully",
      },
      { status: 200 },
    );
  } catch (error) {
    logError("sendOtp failed", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 },
    );
  }
}
