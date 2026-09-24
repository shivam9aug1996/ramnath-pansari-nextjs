import { ObjectId } from "mongodb";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

import { getTokenCandidatesFromRequest } from "@/app/api/lib/authToken";
import { connectDB } from "@/app/api/lib/dbconnection";
import { signJwt, verifyJwt } from "@/app/api/lib/jwt";
import { enforceRateLimit } from "@/app/api/lib/rateLimit";
import { logError } from "@/app/api/lib/logger";

async function issueGuestToken(userId: string) {
  return signJwt(
    {
      id: userId,
      isGuestUser: true,
      isDriverUser: false,
      isAdminUser: false,
    },
    { expiresIn: "30d" },
  );
}

function setGuestCookies(token: string, userId: string) {
  const options = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
  };
  cookies().set("ramnath_pansari_user_token", token, options);
  cookies().set(
    "ramnath_pansari_user_data",
    JSON.stringify({ userId, isGuestUser: true }),
    options,
  );
}

function guestResponse(token: string, userId: string, reused: boolean) {
  return NextResponse.json(
    {
      token,
      userId,
      isGuestUser: true,
      reused,
      userData: {
        _id: userId,
        name: "Guest User",
        isGuestUser: true,
      },
    },
    { status: 200 },
  );
}

export async function POST(req: NextRequest) {
  try {
    const candidates = getTokenCandidatesFromRequest(req);
    for (const { token } of candidates) {
      if (token === "guest_token") continue;
      const payload = await verifyJwt(token);
      if (!payload || typeof payload.id !== "string" || !payload.id) continue;
      if (payload.isGuestUser) {
        return guestResponse(token, payload.id, true);
      }
      return NextResponse.json(
        { message: "Already authenticated" },
        { status: 409 },
      );
    }

    const limited = await enforceRateLimit(req, "guestCreate");
    if (limited) return limited;

    const db = await connectDB(req);
    const createdAt = new Date();
    const inserted = await db.collection("users").insertOne({
      isGuestUser: true,
      name: "Guest User",
      createdAt,
    });
    const userId = inserted.insertedId.toString();

    await db.collection("carts").insertOne({
      userId: new ObjectId(userId),
      items: [],
    });

    const token = await issueGuestToken(userId);
    setGuestCookies(token, userId);
    return guestResponse(token, userId, false);
  } catch (error) {
    logError("auth/guest create failed", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 },
    );
  }
}
