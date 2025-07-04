import { NextResponse } from "next/server";
import { connectDB } from "../../lib/dbconnection";
import { client, serviceSid } from "../../lib/twilioClient";

export async function POST(req, res) {
  if (req.method !== "POST") {
    return NextResponse.json(
      { message: "Method not allowed" },
      { status: 405 }
    );
  }

  try {
    const { mobileNumber } = await req.json();

    if (!mobileNumber) {
      return NextResponse.json(
        { message: "Missing mobile number" },
        { status: 400 }
      );
    }
    // throw Error("hi");

    // Send OTP using Twilio

    // if (
    //   process.env.NODE_ENV !== "development"
    // ) {
    //   if(mobileNumber!=="9999999999") {
    //     try {
    //       const verification = await client.verify.v2
    //         .services(serviceSid)
    //         .verifications.create({ to: `+91${mobileNumber}`, channel: "sms" });
    //       console.log("verification", JSON.stringify(verification));
    //     } catch (error) {
    //       console.log(error);
    //       return NextResponse.json(
    //         { error: "Error from twilio" },
    //         { status: 400 }
    //       );
    //     }
    //   }
    // }

    // console.log(`Verification SID: ${JSON.stringify(verification)}`);

    // Check if user already exists in the database
    const db = await connectDB(req);
    const user = await db.collection("users").findOne({ mobileNumber });

    return NextResponse.json(
      {
        userAlreadyRegistered: !!user,
        message: "OTP sent successfully",
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
