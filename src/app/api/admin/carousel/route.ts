import { NextResponse } from "next/server";
import { connectDB } from "@/app/api/lib/dbconnection";
import { requireAdmin } from "@/app/api/admin/requireAdmin";
import {
  buildCarouselBannerFromInput,
  compareCarouselBanners,
  ensureCarouselBannerBlurhash,
  getAllCarouselBanners,
  normalizeCarouselBannerForResponse,
  saveCarouselBanners,
  validateCarouselCategoryExists,
  validateCarouselInput,
} from "@/app/api/carousel/carouselUtils";
import type { CarouselBanner } from "@/app/api/carousel/carouselTypes";

function buildError(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export async function GET(req: Request) {
  const authError = await requireAdmin(req);
  if (authError) return authError;

  try {
    const db = await connectDB(req);
    const banners = await getAllCarouselBanners(db);
    return NextResponse.json({
      banners: banners.map(normalizeCarouselBannerForResponse),
    });
  } catch (error) {
    console.error("[admin/carousel] GET error:", error);
    return buildError("INTERNAL", "Failed to fetch carousel banners", 500);
  }
}

export async function POST(req: Request) {
  const authError = await requireAdmin(req);
  if (authError) return authError;

  try {
    const body = (await req.json()) as Partial<CarouselBanner>;
    const validation = validateCarouselInput(body);
    if (!validation.valid) {
      return buildError("VALIDATION", validation.message ?? "Invalid input", 400);
    }

    const db = await connectDB(req);
    const categoryCheck = await validateCarouselCategoryExists(db, body);
    if (!categoryCheck.valid) {
      return buildError(
        "VALIDATION",
        categoryCheck.message ?? "Invalid category",
        400,
      );
    }

    const banners = await getAllCarouselBanners(db);
    const built = buildCarouselBannerFromInput(body);
    const newBanner = await ensureCarouselBannerBlurhash(built);
    const updated = [...banners, newBanner].sort(compareCarouselBanners);
    await saveCarouselBanners(db, updated);

    return NextResponse.json(
      { banner: normalizeCarouselBannerForResponse(newBanner) },
      { status: 201 },
    );
  } catch (error) {
    console.error("[admin/carousel] POST error:", error);
    return buildError("INTERNAL", "Failed to create carousel banner", 500);
  }
}
