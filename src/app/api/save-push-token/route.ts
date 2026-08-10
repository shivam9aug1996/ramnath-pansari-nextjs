import { connectDB } from "../lib/dbconnection";
import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { isTokenVerified } from "@/json";
import { getTokenCandidatesFromRequest } from "@/app/api/lib/authToken";
import { requireSameUser } from "@/app/api/lib/requireAuth";

export async function POST(req: NextRequest) {
  const { token, userId: requestedUserId } = await req.json();

  const tokenVerificationResponse = await isTokenVerified(req);
  if (tokenVerificationResponse) {
    return tokenVerificationResponse;
  }

  if (!token || !requestedUserId) {
    return NextResponse.json(
      { error: "Missing token or userId" },
      { status: 400 },
    );
  }

  const candidates = getTokenCandidatesFromRequest(req);
  const isGuestToken = candidates.some(({ token: t }) => t === "guest_token");

  let userId = String(requestedUserId);
  let isGuestUser = false;
  let isAdminUser = false;

  if (isGuestToken) {
    isGuestUser = true;
    isAdminUser = false;
  } else {
    const auth = await requireSameUser(req, requestedUserId);
    if (auth instanceof NextResponse) return auth;
    userId = auth.userId;

    const dbUsers = await connectDB();
    const user = await dbUsers.collection("users").findOne({
      _id: new ObjectId(userId),
    });
    isGuestUser = Boolean(user?.isGuestUser);
    isAdminUser = Boolean(user?.isAdminUser);
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
