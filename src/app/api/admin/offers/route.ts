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

function buildError(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export async function GET(req: Request) {
  const authError = await requireAdmin(req);
  if (authError) return authError;

  try {
    const db = await connectDB(req);
    const offers = await getAllOffers(db);
    return NextResponse.json({
      offers: offers.map(normalizeOfferForResponse),
    });
  } catch (error) {
    console.error("[admin/offers] GET error:", error);
    return buildError("INTERNAL", "Failed to fetch offers", 500);
  }
}

export async function POST(req: Request) {
  const authError = await requireAdmin(req);
  if (authError) return authError;

  try {
    const body = (await req.json()) as Partial<Offer>;
    const validation = validateOfferInput(body);
    if (!validation.valid) {
      return buildError("VALIDATION", validation.message ?? "Invalid input", 400);
    }

    const db = await connectDB(req);
    const productCheck = await validateOfferProductsExist(db, body);
    if (!productCheck.valid) {
      return buildError("VALIDATION", productCheck.message ?? "Invalid product", 400);
    }

    const offers = await getAllOffers(db);
    const newOffer = buildOfferFromInput(body);
    const updated = [...offers, newOffer].sort(
      (a, b) => a.sortOrder - b.sortOrder,
    );
    await saveOffers(db, updated);

    return NextResponse.json(
      { offer: normalizeOfferForResponse(newOffer) },
      { status: 201 },
    );
  } catch (error) {
    console.error("[admin/offers] POST error:", error);
    return buildError("INTERNAL", "Failed to create offer", 500);
  }
}
