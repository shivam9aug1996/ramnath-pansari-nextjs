import { isTokenVerified } from "@/json";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function POST(req, res) {
  try {
    if (req.method !== "POST") {
      return NextResponse.json(
        { message: "Method not allowed" },
        { status: 405 }
      );
    }
    const response = await isTokenVerified(req);
    if (response) {
      return response;
    }
    cookies().delete("ramnath_pansari_user_token");
    cookies().delete("ramnath_pansari_user_data");

    return NextResponse.json({ message: "logout successful" }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
