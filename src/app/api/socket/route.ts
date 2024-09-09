import { isTokenVerified } from "@/json";
import { NextResponse } from "next/server";
import { pusher } from "../lib/pusher";

export async function POST(req, res) {
  if (req.method === "POST") {
    try {
      let { data } = await req.json();
      console.log("kjhfghjkl;", data);
      const tokenVerificationResponse = await isTokenVerified(req);
      if (tokenVerificationResponse) {
        return tokenVerificationResponse;
      }
      await pusher.trigger("c1", "e1", {
        message: "driver location",
        data: data,
      });

      return NextResponse.json(
        {
          message: "message sent successfully",
        },
        { status: 200 }
      );
    } catch (error) {
      console.log("gfghjkl", error);
      return NextResponse.json(
        { message: "Something went wrong" },
        { status: 500 }
      );
    }
  } else {
    return NextResponse.json(
      { message: "Method Not Allowed" },
      { status: 405 }
    );
  }
}
