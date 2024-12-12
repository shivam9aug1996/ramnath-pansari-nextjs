import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { connectDB } from "../../lib/dbconnection";
import { secretKey } from "../../lib/keys";
import { client, serviceSid } from "../../lib/twilioClient";
import { cookies } from "next/headers";
import { ObjectId } from "mongodb";

const generateToken = (user: any) => {
  const payload = {
    id: user?._id?.toString(),
    mobileNumber: user?.mobileNumber,
  };
  console.log("oiuytrdfghjkl", payload);
  const options = { expiresIn: "1d" };
  return jwt.sign(payload, secretKey, options);
};

export async function POST(req, res) {
  if (req.method !== "POST") {
    return NextResponse.json(
      { message: "Method not allowed" },
      { status: 405 }
    );
  }

  try {
    const { mobileNumber, otp } = await req.json();

    if (!mobileNumber || !otp) {
      return NextResponse.json(
        { message: "Missing mobile number or otp" },
        { status: 400 }
      );
    }
    console.log(mobileNumber, otp);

    // Send OTP using Twilio
    let status = "approved";
    // try {
    //   const verificationCheck = await client.verify.v2
    //     .services(serviceSid)
    //     .verificationChecks.create({
    //       code: otp,
    //       to: `+91${mobileNumber}`,
    //     });
    //   console.log(verificationCheck);
    //   if (verificationCheck.status == "approved") {
    //     status = "approved";
    //   } else if (verificationCheck.status == "pending") {
    //     status = "pending";
    //   }
    // } catch (error) {
    //   console.log(error);
    //   status = "error";
    // }

    // Check if user already exists in the database

    if (status == "approved") {
      const db = await connectDB(req);
      const user = await db.collection("users").findOne({ mobileNumber });

      if (user) {
        let token = generateToken(user);
        console.log("jhgfdsdfiop98765", token);
        let now = new Date();
        let expirationDate = new Date(now.getTime() + 1 * 1000);
        cookies().set("ramnath_pansari_user_token", token, {
          expires: expirationDate,
          // httpOnly: true,
          // secure: true,
        });
        cookies().set(
          "ramnath_pansari_user_data",
          JSON.stringify({ mobileNumber, userId: user?._id }),
          {
            expires: expirationDate,
            // httpOnly: true,
            // secure: true,
          }
        );

        return NextResponse.json(
          {
            message: "OTP successfully verified1",
            userAlreadyRegistered: true,
            userData: { ...user, userAlreadyRegistered: true },
            token: token,
          },
          { status: 200 }
        );
      } else {
        const result = await db.collection("users").insertOne({ mobileNumber });
        const user = await db.collection("users").findOne({ mobileNumber });

        //create new entry in db
        console.log(result);
        console.log(result.ops);
        const token = generateToken(user);
        await db.collection("carts").insertOne({
          userId: new ObjectId(user._id),
          items: [],
        });

        return NextResponse.json(
          {
            message: "OTP successfully verified",
            userAlreadyRegistered: false,
            userData: { ...user, userAlreadyRegistered: false },
            token: token,
          },
          { status: 200 }
        );
      }
    } else if (status == "pending") {
      return NextResponse.json(
        {
          message: "Wrong OTP",
        },
        { status: 200 }
      );
    } else if (status == "error" || status == "") {
      return NextResponse.json(
        { error: "Error from twillio" },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
