import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "../../lib/dbconnection";

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

    return NextResponse.json(
      {
        userAlreadyRegistered: !!user,
        message: "OTP sent successfully",
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 },
    );
  }
}
