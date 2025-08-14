import { ObjectId } from "mongodb";
import { connectDB } from "../lib/dbconnection";
import { NextResponse } from "next/server";


export async function POST(req) {
  const { token, userId, isGuestUser = false, isAdminUser = false } = await req.json();

  if (!token || !userId) {
    return NextResponse.json({ error: "Missing token or userId" }, { status: 400 });
  }

  const db = await connectDB();
  const pushTokens = db.collection("pushTokens");

  // 1. Remove token from all other users
  await pushTokens.updateMany(
    { tokens: token },
    { $pull: { tokens: token } }
  );

  // 2. Upsert document for current user
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
    { upsert: true }
  );

  return NextResponse.json({ success: true });
}




