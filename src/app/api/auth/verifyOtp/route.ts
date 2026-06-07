import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { connectDB } from "../../lib/dbconnection";
import { secretKey } from "../../lib/keys";
import { cookies } from "next/headers";
import { ObjectId } from "mongodb";
import bcrypt from "bcryptjs";

const generateToken = (user: any, isGuestUser: boolean = false) => {
  const payload = {
    id: user?._id?.toString(),
    mobileNumber: user?.mobileNumber,
    isGuestUser: isGuestUser,
  };
  console.log("oiuytrdfghjkl", payload);
  const options = {};
  return jwt.sign(payload, secretKey!, options);
};

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
        { message: "Missing mobile number or otp" },
        { status: 400 },
      );
    }
    console.log(mobileNumber, otp, password);

    let status = "approved";

    if (status == "approved") {
      const db = await connectDB(req);
      console.log("jhgfghjhgfghjk", db);

      const user = await db.collection("users").findOne({ mobileNumber });
      console.log("us67890-r", user);
      const isGuestUser = mobileNumber === "9999999991";
      const isAdminUser = mobileNumber === "8888888888";

      if (user) {
        if (password) {
          const isPasswordCorrect = await bcrypt.compare(
            password,
            user.password,
          );
          if (!isPasswordCorrect) {
            return NextResponse.json(
              { error: "Incorrect password" },
              { status: 400 },
            );
          }
        }

        let token = generateToken(user, isGuestUser);
        console.log("jhgfdsdfiop98765", token);

        const existingCart = await db
          .collection("carts")
          .findOne({ userId: new ObjectId(user._id) });
        if (!existingCart) {
          await db.collection("carts").insertOne({
            userId: new ObjectId(user._id),
            items: [],
          });
        }

        cookies().set("ramnath_pansari_user_token", token, {});
        cookies().set(
          "ramnath_pansari_user_data",
          JSON.stringify({ mobileNumber, userId: user?._id }),
          {},
        );

        const response = {
          message: "OTP successfully verified",
          userAlreadyRegistered: true,
          userData: { ...user, userAlreadyRegistered: true },
          token: token,
        };
        const newRes = isGuestUser
          ? {
              ...response,
              isGuestUser: true,
              userData: { ...user, name: "Guest User", isGuestUser: true },
            }
          : isAdminUser
            ? {
                ...response,
                isAdminUser: true,
                userData: { ...user, name: "Admin User", isAdminUser: true },
              }
            : response;

        return NextResponse.json(newRes, { status: 200 });
      } else {
        const hash = await bcrypt.hashSync(password, 10);
        console.log("hash", hash);
        const result = await db
          .collection("users")
          .insertOne({ mobileNumber, password: hash });
        const user = await db.collection("users").findOne({ mobileNumber });

        console.log("34567890-=", result);
        if (!user) {
          return NextResponse.json(
            { error: "User creation failed" },
            { status: 500 },
          );
        }
        const token = generateToken(user, isGuestUser);
        await db.collection("carts").insertOne({
          userId: new ObjectId(user._id),
          items: [],
        });
        const response = {
          message: "OTP successfully verified",
          userAlreadyRegistered: false,
          userData: { ...user, userAlreadyRegistered: false },
          token: token,
        };
        const newRes = isGuestUser
          ? {
              ...response,
              isGuestUser: true,
              userData: { ...user, name: "Guest User", isGuestUser: true },
            }
          : isAdminUser
            ? {
                ...response,
                isAdminUser: true,
                userData: { ...user, name: "Admin User", isAdminUser: true },
              }
            : response;
        return NextResponse.json(newRes, { status: 200 });
      }
    } else if (status == "pending") {
      return NextResponse.json(
        {
          error: "Incorrect OTP. Please enter the correct code.",
        },
        { status: 400 },
      );
    } else if (status == "error" || status == "") {
      return NextResponse.json(
        { error: "Error from twillio" },
        { status: 400 },
      );
    }
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 },
    );
  }
}
