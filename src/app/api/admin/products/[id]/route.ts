import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { connectDB } from "@/app/api/lib/dbconnection";
import { requireAdmin } from "@/app/api/admin/requireAdmin";
import { formatProductDetailResponse } from "@/app/api/products/formatProductDetail";
import {
  buildProductWritePayload,
  invalidateProductCache,
  normalizeProductForResponse,
  resolveCategoryPathFromLeafId,
  validateProductInput,
} from "@/app/api/admin/products/productUtils";
import {
  buildProductOfferUsage,
  getLiveOffersUsingProduct,
  validateProductDeleteAgainstLiveOffers,
  validateProductUpdateAgainstLiveOffers,
} from "@/app/api/admin/products/productOfferGuard";

type RouteContext = { params: Promise<{ id: string }> };

function buildError(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export async function GET(req: Request, context: RouteContext) {
  const authError = await requireAdmin(req);
  if (authError) return authError;

  try {
    const { id } = await context.params;
    if (!ObjectId.isValid(id)) {
      return buildError("VALIDATION", "Invalid product id", 400);
    }

    const db = await connectDB(req);
    const product = await db.collection("products").findOne({
      _id: new ObjectId(id),
      isDeleted: { $ne: true },
    });

    if (!product) {
      return buildError("NOT_FOUND", "Product not found", 404);
    }

    const liveOffers = await getLiveOffersUsingProduct(db, id);

    return NextResponse.json({
      product: normalizeProductForResponse(product as never),
      detail: formatProductDetailResponse(product as never),
      offerUsage: buildProductOfferUsage(liveOffers),
    });
  } catch (error) {
    console.error("[admin/products/:id] GET error:", error);
    return buildError("INTERNAL", "Failed to fetch product", 500);
  }
}

export async function PUT(req: Request, context: RouteContext) {
  const authError = await requireAdmin(req);
  if (authError) return authError;

  try {
    const { id } = await context.params;
    if (!ObjectId.isValid(id)) {
      return buildError("VALIDATION", "Invalid product id", 400);
    }

    const body = await req.json();
    const validation = validateProductInput(body);
    if (!validation.valid) {
      return buildError("VALIDATION", validation.message ?? "Invalid input", 400);
    }

    const db = await connectDB(req);
    const existing = await db.collection("products").findOne({
      _id: new ObjectId(id),
      isDeleted: { $ne: true },
    });
    if (!existing) {
      return buildError("NOT_FOUND", "Product not found", 404);
    }

    const liveOffers = await getLiveOffersUsingProduct(db, id);
    const offerGuard = validateProductUpdateAgainstLiveOffers(
      existing as { promoOnly?: boolean },
      body,
      liveOffers,
    );
    if (!offerGuard.valid) {
      return buildError("CONFLICT", offerGuard.message ?? "Blocked by live offer", 409);
    }

    const leafId = String((body.categoryPath as string[]).at(-1));
    const resolvedPath =
      (await resolveCategoryPathFromLeafId(db, leafId)) ??
      (body.categoryPath as string[]).map((cid) => new ObjectId(String(cid)));

    const payload = buildProductWritePayload(body, resolvedPath);
    delete payload.createdAt;
    delete payload.productFromJio;

    await db.collection("products").updateOne(
      { _id: new ObjectId(id) },
      { $set: payload },
    );
    await invalidateProductCache();

    const updated = await db.collection("products").findOne({ _id: new ObjectId(id) });
    return NextResponse.json({
      product: normalizeProductForResponse(updated as never),
    });
  } catch (error) {
    console.error("[admin/products/:id] PUT error:", error);
    return buildError("INTERNAL", "Failed to update product", 500);
  }
}

export async function DELETE(req: Request, context: RouteContext) {
  const authError = await requireAdmin(req);
  if (authError) return authError;

  try {
    const { id } = await context.params;
    if (!ObjectId.isValid(id)) {
      return buildError("VALIDATION", "Invalid product id", 400);
    }

    const db = await connectDB(req);
    const existing = await db.collection("products").findOne({
      _id: new ObjectId(id),
      isDeleted: { $ne: true },
    });
    if (!existing) {
      return buildError("NOT_FOUND", "Product not found", 404);
    }

    const liveOffers = await getLiveOffersUsingProduct(db, id);
    const deleteGuard = validateProductDeleteAgainstLiveOffers(liveOffers);
    if (!deleteGuard.valid) {
      return buildError("CONFLICT", deleteGuard.message ?? "Blocked by live offer", 409);
    }

    const result = await db.collection("products").updateOne(
      { _id: new ObjectId(id), isDeleted: { $ne: true } },
      { $set: { isDeleted: true, lastUpdated: new Date() } },
    );

    if (result.matchedCount === 0) {
      return buildError("NOT_FOUND", "Product not found", 404);
    }

    await invalidateProductCache();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[admin/products/:id] DELETE error:", error);
    return buildError("INTERNAL", "Failed to delete product", 500);
  }
}
