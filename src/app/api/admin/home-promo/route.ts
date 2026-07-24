import { NextResponse } from "next/server";
import { connectDB } from "@/app/api/lib/dbconnection";
import { requireAdmin } from "@/app/api/admin/requireAdmin";
import {
  getHomeProductPromo,
  normalizeHomeProductPromo,
  saveHomeProductPromo,
  validateHomeProductPromoInput,
} from "@/app/api/home-promo/homePromoUtils";
import type { HomeProductPromo } from "@/app/api/home-promo/homePromoTypes";

function buildError(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export async function GET(req: Request) {
  const authError = await requireAdmin(req);
  if (authError) return authError;

  try {
    const db = await connectDB(req);
    const promo = await getHomeProductPromo(db);
    return NextResponse.json({ promo });
  } catch (error) {
    console.error("[admin/home-promo] GET error:", error);
    return buildError("INTERNAL", "Failed to fetch home promo", 500);
  }
}

export async function PUT(req: Request) {
  const authError = await requireAdmin(req);
  if (authError) return authError;

  try {
    const body = (await req.json()) as Partial<HomeProductPromo>;
    const validation = validateHomeProductPromoInput(body);
    if (!validation.valid) {
      return buildError("VALIDATION", validation.message ?? "Invalid input", 400);
    }

    const db = await connectDB(req);
    const existing = await getHomeProductPromo(db);
    const next = normalizeHomeProductPromo({
      ...existing,
      ...body,
      id: existing.id,
      createdAt: existing.createdAt,
      updatedAt: new Date().toISOString(),
    });

    await saveHomeProductPromo(db, next);
    return NextResponse.json({ promo: next });
  } catch (error) {
    console.error("[admin/home-promo] PUT error:", error);
    return buildError("INTERNAL", "Failed to update home promo", 500);
  }
}
