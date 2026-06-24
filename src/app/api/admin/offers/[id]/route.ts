import { NextResponse } from "next/server";
import { connectDB } from "@/app/api/lib/dbconnection";
import { requireAdmin } from "@/app/api/admin/requireAdmin";
import {
  buildOfferFromInput,
  getAllOffers,
  normalizeOfferForResponse,
  saveOffers,
  validateOfferInput,
  validateOfferProductsExist,
} from "@/app/api/offers/offerUtils";
import type { Offer } from "@/app/api/offers/offerTypes";

type RouteContext = { params: Promise<{ id: string }> };

function buildError(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export async function PUT(req: Request, context: RouteContext) {
  const authError = await requireAdmin(req);
  if (authError) return authError;

  try {
    const { id } = await context.params;
    const body = (await req.json()) as Partial<Offer>;

    const validation = validateOfferInput(body, true);
    if (!validation.valid) {
      return buildError("VALIDATION", validation.message ?? "Invalid input", 400);
    }

    const db = await connectDB(req);
    const offers = await getAllOffers(db);
    const index = offers.findIndex((o) => o.id === id);
    if (index === -1) {
      return buildError("NOT_FOUND", "Offer not found", 404);
    }

    const merged = buildOfferFromInput(
      { ...body, type: body.type ?? offers[index].type },
      offers[index],
    );

    const productCheck = await validateOfferProductsExist(db, merged);
    if (!productCheck.valid) {
      return buildError("VALIDATION", productCheck.message ?? "Invalid product", 400);
    }

    offers[index] = merged;
    await saveOffers(
      db,
      offers.sort((a, b) => a.sortOrder - b.sortOrder),
    );

    return NextResponse.json({ offer: normalizeOfferForResponse(merged) });
  } catch (error) {
    console.error("[admin/offers/:id] PUT error:", error);
    return buildError("INTERNAL", "Failed to update offer", 500);
  }
}

export async function DELETE(req: Request, context: RouteContext) {
  const authError = await requireAdmin(req);
  if (authError) return authError;

  try {
    const { id } = await context.params;
    const db = await connectDB(req);
    const offers = await getAllOffers(db);
    const filtered = offers.filter((o) => o.id !== id);

    if (filtered.length === offers.length) {
      return buildError("NOT_FOUND", "Offer not found", 404);
    }

    await saveOffers(db, filtered);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[admin/offers/:id] DELETE error:", error);
    return buildError("INTERNAL", "Failed to delete offer", 500);
  }
}
