import { isTokenVerified } from "@/json";
import { ObjectId } from "mongodb";
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "../../lib/dbconnection";
import { formatProductDetailResponse } from "../formatProductDetail";
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const productId = searchParams.get("productId");
    if (!productId) {
      return NextResponse.json(
        { message: "Missing productId ID" },
        { status: 400 },
      );
    }
    const tokenVerificationResponse = await isTokenVerified(req);
    if (tokenVerificationResponse) {
      return tokenVerificationResponse;
    }
    const db = await connectDB(req);
    const product = await db
      .collection("products")
      .findOne({ _id: new ObjectId(productId) });
    if (!product) {
      return NextResponse.json(
        { message: "Product not found" },
        { status: 404 },
      );
    }
    if ((product as { promoOnly?: boolean }).promoOnly) {
      return NextResponse.json(
        { message: "Product not found" },
        { status: 404 },
      );
    }
    return NextResponse.json(formatProductDetailResponse(product), {
      status: 200,
    });
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 },
    );
  }
}
