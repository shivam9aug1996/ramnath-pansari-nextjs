import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { connectDB } from "@/app/api/lib/dbconnection";
import { requireAdmin } from "@/app/api/admin/requireAdmin";
import {
  buildProductListFilter,
  buildProductSearchFilter,
  buildProductWritePayload,
  invalidateProductCache,
  normalizeProductForResponse,
  resolveCategoryPathFromLeafId,
  validateProductInput,
} from "@/app/api/admin/products/productUtils";

function buildError(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export async function GET(req: Request) {
  const authError = await requireAdmin(req);
  if (authError) return authError;

  try {
    const { searchParams } = new URL(req.url);
    const page = Math.max(parseInt(searchParams.get("page") || "1", 10), 1);
    const limit = Math.max(parseInt(searchParams.get("limit") || "20", 10), 1);
    const search = (searchParams.get("search") || "").trim();
    const categoryId = (searchParams.get("categoryId") || "").trim();
    const stock = (searchParams.get("stock") || "").trim();
    const promoOnly = (searchParams.get("promoOnly") || "").trim();
    const deleted = (searchParams.get("deleted") || "").trim();

    const db = await connectDB(req);
    const baseFilter = buildProductListFilter({
      categoryId,
      stock,
      promoOnly,
      deleted,
    });
    const searchFilter = buildProductSearchFilter(search);
    const finalFilter =
      Object.keys(searchFilter).length > 0
        ? { $and: [baseFilter, searchFilter] }
        : baseFilter;

    const skip = (page - 1) * limit;
    const productsRaw = await db
      .collection("products")
      .find(finalFilter)
      .sort({ lastUpdated: -1, name: 1 })
      .skip(skip)
      .limit(limit)
      .toArray();

    const totalCount = await db.collection("products").countDocuments(finalFilter);
    const totalPages = Math.max(Math.ceil(totalCount / limit), 1);
    const products = productsRaw
      .map((p) => normalizeProductForResponse(p as never))
      .filter(Boolean);

    return NextResponse.json({
      products,
      currentPage: page,
      totalPages,
      totalCount,
    });
  } catch (error) {
    console.error("[admin/products] GET error:", error);
    return buildError("INTERNAL", "Failed to fetch products", 500);
  }
}

export async function POST(req: Request) {
  const authError = await requireAdmin(req);
  if (authError) return authError;

  try {
    const body = await req.json();
    const validation = validateProductInput(body);
    if (!validation.valid) {
      return buildError("VALIDATION", validation.message ?? "Invalid input", 400);
    }

    const db = await connectDB(req);
    const leafId = String((body.categoryPath as string[]).at(-1));
    const resolvedPath =
      (await resolveCategoryPathFromLeafId(db, leafId)) ??
      (body.categoryPath as string[]).map((id) => new ObjectId(String(id)));

    const payload = buildProductWritePayload(body, resolvedPath);
    payload._id = new ObjectId();
    payload.createdAt = new Date();
    payload.productFromJio = false;
    if (payload.promoOnly == null) {
      payload.promoOnly = false;
    }

    await db.collection("products").insertOne(payload);
    await invalidateProductCache();

    return NextResponse.json(
      { product: normalizeProductForResponse(payload) },
      { status: 201 },
    );
  } catch (error) {
    console.error("[admin/products] POST error:", error);
    return buildError("INTERNAL", "Failed to create product", 500);
  }
}
