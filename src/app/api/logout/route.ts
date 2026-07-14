import { isTokenVerified } from "@/json";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

const AUTH_COOKIE_CLEAR = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 0,
};

export async function POST(req: NextRequest) {
  try {
    if (req.method !== "POST") {
      return NextResponse.json(
        { message: "Method not allowed" },
        { status: 405 },
      );
    }
    const response = await isTokenVerified(req);
    if (response) {
      return response;
    }
    cookies().set("ramnath_pansari_user_token", "", AUTH_COOKIE_CLEAR);
    cookies().set("ramnath_pansari_user_data", "", AUTH_COOKIE_CLEAR);
    return NextResponse.json({ message: "logout successful" }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 },
    );
  }
}
