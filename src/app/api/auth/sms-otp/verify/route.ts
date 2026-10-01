import { ObjectId } from "mongodb";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

import {
  isReservedLoginMobile,
  normalizeMobileNumber,
  verifyLoginOtp,
} from "@/app/api/auth/smsOtpUtils";
import { connectDB } from "@/app/api/lib/dbconnection";
import { signJwt } from "@/app/api/lib/jwt";
import { enforceRateLimit, getClientIp } from "@/app/api/lib/rateLimit";
import { logError } from "@/app/api/lib/logger";
import {
  resolveIsAdmin,
  resolveIsDriver,
  type UserDocument,
} from "@/app/api/admin/users/userUtils";

async function generateToken(user: UserDocument) {
  const payload = {
    id: user?._id?.toString(),
    mobileNumber: user?.mobileNumber,
    isGuestUser: false,
    isDriverUser: resolveIsDriver(user),
    isAdminUser: resolveIsAdmin(user),
  };
  return signJwt(payload, { expiresIn: "30d" });
}

function authCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
  };
}

function setAuthCookies(token: string, mobileNumber: string, userId: unknown) {
  const options = authCookieOptions();
  cookies().set("ramnath_pansari_user_token", token, options);
  cookies().set(
    "ramnath_pansari_user_data",
    JSON.stringify({ mobileNumber, userId }),
    options,
  );
}

async function ensureCart(db: Awaited<ReturnType<typeof connectDB>>, userId: ObjectId) {
  const existingCart = await db.collection("carts").findOne({ userId });
  if (!existingCart) {
    await db.collection("carts").insertOne({
      userId,
      items: [],
    });
  }
}

export async function POST(req: NextRequest) {
  try {
    const limitedIp = await enforceRateLimit(
      req,
      "smsOtpVerifyIp",
      getClientIp(req),
    );
    if (limitedIp) return limitedIp;

    const body = await req.json().catch(() => null);
    const mobileNumber = normalizeMobileNumber(
      body?.mobileNumber ?? body?.mobile ?? body?.numbers,
    );
    const otp = body?.otp != null ? String(body.otp).trim() : "";

    if (!mobileNumber) {
      return NextResponse.json(
        { message: "Enter a valid 10-digit mobile number" },
        { status: 400 },
      );
    }

    if (!/^\d{6}$/.test(otp)) {
      return NextResponse.json(
        { message: "Enter the 6-digit OTP" },
        { status: 400 },
      );
    }

    if (isReservedLoginMobile(mobileNumber)) {
      return NextResponse.json(
        { message: "This number cannot use SMS login" },
        { status: 400 },
      );
    }

    const db = await connectDB(req);
    const otpResult = await verifyLoginOtp(db, mobileNumber, otp);

    if (!otpResult.ok) {
      const messageByCode = {
        missing: "OTP expired. Request a new one.",
        expired: "OTP expired. Request a new one.",
        invalid: "Incorrect OTP. Try again.",
        locked: "Too many incorrect attempts. Request a new OTP.",
      } as const;
      return NextResponse.json(
        {
          message: messageByCode[otpResult.code],
          code: otpResult.code,
        },
        { status: 400 },
      );
    }

    let user = (await db
      .collection("users")
      .findOne({ mobileNumber })) as UserDocument | null;
    let userAlreadyRegistered = Boolean(user);

    if (!user) {
      const insert = await db.collection("users").insertOne({
        mobileNumber,
        isGuestUser: false,
        isAdminUser: false,
        isDriverUser: false,
        createdAt: new Date(),
        authProvider: "sms_otp",
      });
      user = (await db
        .collection("users")
        .findOne({ _id: insert.insertedId })) as UserDocument | null;
      userAlreadyRegistered = false;
    } else if (user.isGuestUser) {
      await db.collection("users").updateOne(
        { _id: user._id },
        {
          $set: {
            isGuestUser: false,
            mobileNumber,
            authProvider: "sms_otp",
          },
        },
      );
      user = {
        ...user,
        isGuestUser: false,
        mobileNumber,
      };
    }

    if (!user?._id) {
      return NextResponse.json(
        { message: "User creation failed" },
        { status: 500 },
      );
    }

    // Existing password users keep their password; SMS-only users have none.
    // Never clear password here so old-app password login still works.

    await ensureCart(db, new ObjectId(user._id));
    const token = await generateToken(user);
    setAuthCookies(token, mobileNumber, user._id);

    const { password: _password, ...safeUser } = user as UserDocument & {
      password?: string;
    };

    return NextResponse.json(
      {
        message: "OTP successfully verified",
        userAlreadyRegistered,
        userData: {
          ...safeUser,
          userAlreadyRegistered,
          isGuestUser: false,
          mobileNumber,
        },
        token,
      },
      { status: 200 },
    );
  } catch (error) {
    logError("sms-otp/verify failed", error);
    return NextResponse.json(
      { message: "Verification failed. Try again." },
      { status: 500 },
    );
  }
}
