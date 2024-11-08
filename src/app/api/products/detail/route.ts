import { isTokenVerified } from "@/json";
import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";
import { connectDB } from "../../lib/dbconnection";

export async function GET(req, res) {
  try {
    const { searchParams } = new URL(req.url);
    const productId = searchParams.get("productId");

    if (!productId) {
      return NextResponse.json(
        { message: "Missing productId ID" },
        { status: 400 }
      );
    }

    // Verify token (example function, replace with your authentication logic)
    const tokenVerificationResponse = await isTokenVerified(req);
    if (tokenVerificationResponse) {
      return tokenVerificationResponse;
    }

    const db = await connectDB(req);
    // await new Promise((res) => {
    //   setTimeout(() => {
    //     res("hi");
    //   }, 3000);
    // });

    // Find products where categoryPath contains the specified category ID
    const product = await db
      .collection("products")
      .findOne({ _id: new ObjectId(productId) });
    console.log("iuytrdfghjkl", product);
    // await new Promise((res) => {
    //   setTimeout(() => {
    //     res("hi");
    //   }, 3000);
    // });
    // Get the total count of documents for the category (for calculating total pages)

    return NextResponse.json({ product }, { status: 200 });
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
