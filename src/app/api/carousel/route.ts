import { NextResponse } from "next/server";
import { connectDB } from "@/app/api/lib/dbconnection";
import {
  getEnabledCarouselBanners,
  normalizeCarouselBannerForResponse,
} from "@/app/api/carousel/carouselUtils";
import { isTokenVerified } from "@/json";
import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const tokenVerificationResponse = await isTokenVerified(req);
    if (tokenVerificationResponse) {
      return tokenVerificationResponse;
    }
    const db = await connectDB(req);
    const banners = await getEnabledCarouselBanners(db);
    return NextResponse.json(
      {
        banners: banners.map(normalizeCarouselBannerForResponse),
      },
      {
        status: 200,
      },
    );
  } catch (error) {
    console.error("[carousel] GET error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL", message: "Failed to fetch carousel" } },
      { status: 500 },
    );
  }
}
