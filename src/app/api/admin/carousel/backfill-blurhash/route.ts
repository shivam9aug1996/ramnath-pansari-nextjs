import { NextResponse } from "next/server";
import { connectDB } from "@/app/api/lib/dbconnection";
import { requireAdmin } from "@/app/api/admin/requireAdmin";
import {
  backfillCarouselBannerBlurhashes,
  getAllCarouselBanners,
  saveCarouselBanners,
} from "@/app/api/carousel/carouselUtils";

function buildError(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

/** One-time (or occasional) migration for banners missing blurhash. */
export async function POST(req: Request) {
  const authError = await requireAdmin(req);
  if (authError) return authError;

  try {
    const db = await connectDB(req);
    const banners = await getAllCarouselBanners(db);
    const { banners: next, updated } =
      await backfillCarouselBannerBlurhashes(banners);

    if (updated > 0) {
      await saveCarouselBanners(db, next);
    }

    return NextResponse.json({
      success: true,
      updated,
      total: banners.length,
    });
  } catch (error) {
    console.error("[admin/carousel/backfill-blurhash] POST error:", error);
    return buildError(
      "INTERNAL",
      "Failed to backfill carousel blurhash placeholders",
      500,
    );
  }
}
