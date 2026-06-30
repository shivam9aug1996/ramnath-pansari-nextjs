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

type RouteContext = { params: Promise<{ id: string }> };

function buildError(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export async function PUT(req: Request, context: RouteContext) {
  const authError = await requireAdmin(req);
  if (authError) return authError;

  try {
    const { id } = await context.params;
    const body = (await req.json()) as Partial<CarouselBanner>;

    const validation = validateCarouselInput(body, true);
    if (!validation.valid) {
      return buildError("VALIDATION", validation.message ?? "Invalid input", 400);
    }

    const db = await connectDB(req);
    const banners = await getAllCarouselBanners(db);
    const index = banners.findIndex((banner) => banner.id === id);
    if (index === -1) {
      return buildError("NOT_FOUND", "Carousel banner not found", 404);
    }

    const existing = banners[index];
    const merged = await ensureCarouselBannerBlurhash(
      buildCarouselBannerFromInput(
        {
          ...body,
          actionType: body.actionType ?? existing.actionType,
        },
        existing,
      ),
      { previousImageUrl: existing.imageUrl },
    );

    const categoryCheck = await validateCarouselCategoryExists(db, merged);
    if (!categoryCheck.valid) {
      return buildError(
        "VALIDATION",
        categoryCheck.message ?? "Invalid category",
        400,
      );
    }

    banners[index] = merged;
    await saveCarouselBanners(db, banners.sort(compareCarouselBanners));

    return NextResponse.json({
      banner: normalizeCarouselBannerForResponse(merged),
    });
  } catch (error) {
    console.error("[admin/carousel/:id] PUT error:", error);
    return buildError("INTERNAL", "Failed to update carousel banner", 500);
  }
}

export async function DELETE(req: Request, context: RouteContext) {
  const authError = await requireAdmin(req);
  if (authError) return authError;

  try {
    const { id } = await context.params;
    const db = await connectDB(req);
    const banners = await getAllCarouselBanners(db);
    const filtered = banners.filter((banner) => banner.id !== id);

    if (filtered.length === banners.length) {
      return buildError("NOT_FOUND", "Carousel banner not found", 404);
    }

    await saveCarouselBanners(db, filtered);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[admin/carousel/:id] DELETE error:", error);
    return buildError("INTERNAL", "Failed to delete carousel banner", 500);
  }
}
