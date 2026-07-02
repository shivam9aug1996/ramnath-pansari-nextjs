import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "../../lib/dbconnection";
import { signJwt } from "../../lib/jwt";
import { cookies } from "next/headers";
import { ObjectId } from "mongodb";
import bcrypt from "bcryptjs";
import {
  ADMIN_MOBILE_FALLBACK,
  DRIVER_MOBILE_FALLBACK,
  GUEST_MOBILE,
  resolveIsDriver,
} from "@/app/api/admin/users/userUtils";
import {
  createAndSendAdminOtp,
  createAndSendDriverOtp,
  isAdminLoginAttempt,
  isDriverLoginAttempt,
  clearAdminOtp,
  verifyAdminOtp,
} from "../adminOtpUtils";

const generateToken = async (
  user: any,
  isGuestUser: boolean = false,
  isDriverUser: boolean = false,
) => {
  const payload = {
    id: user?._id?.toString(),
    mobileNumber: user?.mobileNumber,
    isGuestUser: isGuestUser,
    isDriverUser,
  };
  const options = {};
  return signJwt(payload, options);
};

function setAuthCookies(token: string, mobileNumber: string, userId: unknown) {
  cookies().set("ramnath_pansari_user_token", token, {});
  cookies().set(
    "ramnath_pansari_user_data",
    JSON.stringify({ mobileNumber, userId }),
    {},
  );
}

export async function POST(req: NextRequest) {
  if (req.method !== "POST") {
    return NextResponse.json(
      { message: "Method not allowed" },
      { status: 405 },
    );
  }

  try {
    const { mobileNumber, otp, password } = await req.json();

    if (!mobileNumber || !password) {
      return NextResponse.json(
        { message: "Missing mobile number or password" },
        { status: 400 },
      );
    }

    const db = await connectDB(req);
    const user = await db.collection("users").findOne({ mobileNumber });
    const isGuestUser = mobileNumber === GUEST_MOBILE;

    if (isAdminLoginAttempt(mobileNumber, user)) {
      if (!otp) {
        return NextResponse.json(
          { error: "OTP is required for admin login" },
          { status: 400 },
        );
      }

      if (!user) {
        return NextResponse.json(
          { error: "Admin account not found" },
          { status: 404 },
        );
      }

      const isPasswordCorrect = await bcrypt.compare(password, user.password);
      if (!isPasswordCorrect) {
        await clearAdminOtp(db, mobileNumber);
        return NextResponse.json(
          { error: "Incorrect password" },
          { status: 400 },
        );
      }

      const isOtpValid = await verifyAdminOtp(db, mobileNumber, String(otp));
      if (!isOtpValid) {
        return NextResponse.json(
          { error: "Incorrect OTP. Please enter the correct code." },
          { status: 400 },
        );
      }

      const token = await generateToken(user, false);

      const existingCart = await db
        .collection("carts")
        .findOne({ userId: new ObjectId(user._id) });
      if (!existingCart) {
        await db.collection("carts").insertOne({
          userId: new ObjectId(user._id),
          items: [],
        });
      }

      setAuthCookies(token, mobileNumber, user._id);

      return NextResponse.json(
        {
          message: "OTP successfully verified",
          userAlreadyRegistered: true,
          isAdminUser: true,
          userData: {
            ...user,
            userAlreadyRegistered: true,
            name: user.name || "Admin User",
            isAdminUser: true,
          },
          token,
        },
        { status: 200 },
      );
    }

    if (isDriverLoginAttempt(mobileNumber, user)) {
      if (!otp) {
        return NextResponse.json(
          { error: "OTP is required for driver login" },
          { status: 400 },
        );
      }

      if (!user) {
        return NextResponse.json(
          { error: "Driver account not found" },
          { status: 404 },
        );
      }

      const isPasswordCorrect = await bcrypt.compare(password, user.password);
      if (!isPasswordCorrect) {
        await clearAdminOtp(db, mobileNumber);
        return NextResponse.json(
          { error: "Incorrect password" },
          { status: 400 },
        );
      }

      const isOtpValid = await verifyAdminOtp(db, mobileNumber, String(otp));
      if (!isOtpValid) {
        return NextResponse.json(
          { error: "Incorrect OTP. Please enter the correct code." },
          { status: 400 },
        );
      }

      const driverId =
        user.driverId != null && String(user.driverId).trim()
          ? String(user.driverId)
          : user._id?.toString();

      if (!user.isDriverUser || !user.driverId) {
        await db.collection("users").updateOne(
          { _id: user._id },
          {
            $set: {
              isDriverUser: true,
              driverId,
            },
          },
        );
      }

      const token = await generateToken(user, false, true);

      const existingCart = await db
        .collection("carts")
        .findOne({ userId: new ObjectId(user._id) });
      if (!existingCart) {
        await db.collection("carts").insertOne({
          userId: new ObjectId(user._id),
          items: [],
        });
      }

      setAuthCookies(token, mobileNumber, user._id);

      return NextResponse.json(
        {
          message: "OTP successfully verified",
          userAlreadyRegistered: true,
          isDriverUser: true,
          userData: {
            ...user,
            userAlreadyRegistered: true,
            name: user.name || "Driver User",
            isDriverUser: true,
            driverId,
          },
          token,
        },
        { status: 200 },
      );
    }

    if (mobileNumber === ADMIN_MOBILE_FALLBACK && !user) {
      return NextResponse.json(
        { error: "Admin account not found" },
        { status: 404 },
      );
    }

    if (mobileNumber === DRIVER_MOBILE_FALLBACK && !user) {
      return NextResponse.json(
        { error: "Driver account not found" },
        { status: 404 },
      );
    }

    if (user) {
      const isPasswordCorrect = await bcrypt.compare(password, user.password);
      if (!isPasswordCorrect) {
        return NextResponse.json(
          { error: "Incorrect password" },
          { status: 400 },
        );
      }

      const isDriverUser = resolveIsDriver(user);
      const driverId =
        user.driverId != null && String(user.driverId).trim()
          ? String(user.driverId)
          : isDriverUser
            ? user._id?.toString()
            : undefined;

      const token = await generateToken(user, isGuestUser, isDriverUser);

      const existingCart = await db
        .collection("carts")
        .findOne({ userId: new ObjectId(user._id) });
      if (!existingCart) {
        await db.collection("carts").insertOne({
          userId: new ObjectId(user._id),
          items: [],
        });
      }

      setAuthCookies(token, mobileNumber, user?._id);

      const response = {
        message: "OTP successfully verified",
        userAlreadyRegistered: true,
        userData: { ...user, userAlreadyRegistered: true },
        token,
      };
      const newRes = isGuestUser
        ? {
            ...response,
            isGuestUser: true,
            userData: { ...user, name: "Guest User", isGuestUser: true },
          }
        : isDriverUser
          ? {
              ...response,
              isDriverUser: true,
              userData: {
                ...user,
                isDriverUser: true,
                driverId,
              },
            }
          : response;

      return NextResponse.json(newRes, { status: 200 });
    }

    const hash = await bcrypt.hashSync(password, 10);
    await db.collection("users").insertOne({ mobileNumber, password: hash });
    const newUser = await db.collection("users").findOne({ mobileNumber });

    if (!newUser) {
      return NextResponse.json(
        { error: "User creation failed" },
        { status: 500 },
      );
    }

    const token = await generateToken(newUser, isGuestUser);
    await db.collection("carts").insertOne({
      userId: new ObjectId(newUser._id),
      items: [],
    });
    setAuthCookies(token, mobileNumber, newUser._id);

    const response = {
      message: "OTP successfully verified",
      userAlreadyRegistered: false,
      userData: { ...newUser, userAlreadyRegistered: false },
      token,
    };
    const newRes = isGuestUser
      ? {
          ...response,
          isGuestUser: true,
          userData: { ...newUser, name: "Guest User", isGuestUser: true },
        }
      : response;

    return NextResponse.json(newRes, { status: 200 });
  } catch {
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 },
    );
  }
}
