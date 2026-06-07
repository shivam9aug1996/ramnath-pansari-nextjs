import { connectDB } from "../lib/dbconnection";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const {
    token,
    userId,
    isGuestUser = false,
    isAdminUser = false,
  } = await req.json();

  if (!token || !userId) {
    return NextResponse.json(
      { error: "Missing token or userId" },
      { status: 400 },
    );
  }

  const db = await connectDB();
  const pushTokens = db.collection("pushTokens");

  await pushTokens.updateMany({ tokens: token }, { $pull: { tokens: token } });

  await pushTokens.updateOne(
    { userId },
    {
      $addToSet: { tokens: token },
      $set: {
        isGuestUser,
        isAdminUser,
        updatedAt: new Date(),
      },
    },
    { upsert: true },
  );

  return NextResponse.json({ success: true });
}
