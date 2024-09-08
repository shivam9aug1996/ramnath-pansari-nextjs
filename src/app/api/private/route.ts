import { isTokenVerified } from "@/json";
import { NextResponse } from "next/server";
import { connectDB } from "../lib/dbconnection";

export async function POST(req, res) {
  if (req.method !== "POST") {
    return NextResponse.json(
      { message: "Method not allowed" },
      { status: 405 }
    );
  }

  try {
    // Check if user already exists in the database
    const response = await isTokenVerified(req);
    if (response) {
      return response;
    }
    const db = await connectDB(req);
    return NextResponse.json(
      {
        message: "private data",
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
