import { NextResponse } from "next/server";
import { connectDB } from "@/app/api/lib/dbconnection";
import {
  getEnabledCarouselBanners,
  normalizeCarouselBannerForResponse,
} from "@/app/api/carousel/carouselUtils";

export async function GET(req: Request) {
  try {
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
