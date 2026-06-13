import { NextResponse } from "next/server";
import { connectDB } from "@/app/api/lib/dbconnection";
import { requireAdmin } from "@/app/api/admin/requireAdmin";
import {
  addCategoryToParent,
  buildNewCategory,
  normalizeCategoryTree,
  normalizeSingleCategory,
} from "@/app/api/admin/categories/categoryUtils";

function buildError(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export async function GET(req: Request) {
  const authError = await requireAdmin(req);
  if (authError) return authError;

  try {
    const db = await connectDB(req);
    const categories = await db.collection("categories").find({}).toArray();
    return NextResponse.json({
      categories: normalizeCategoryTree(categories as never[]),
    });
  } catch (error) {
    console.error("[admin/categories] GET error:", error);
    return buildError("INTERNAL", "Failed to fetch categories", 500);
  }
}

export async function POST(req: Request) {
  const authError = await requireAdmin(req);
  if (authError) return authError;

  try {
    const { parentCategoryId, name, image } = await req.json();

    if (!name || typeof name !== "string" || !name.trim()) {
      return buildError("VALIDATION", "Category name is required", 400);
    }

    const db = await connectDB(req);
    const newCategory = buildNewCategory(name.trim(), image ?? null);

    if (parentCategoryId) {
      const result = await addCategoryToParent(db, String(parentCategoryId), newCategory);
      const modifiedCount = "modifiedCount" in result ? result.modifiedCount : 0;
      if (modifiedCount === 0) {
        return buildError("NOT_FOUND", "Parent category not found", 404);
      }
    } else {
      await db.collection("categories").insertOne(newCategory);
    }

    return NextResponse.json(
      { category: normalizeSingleCategory(newCategory) },
      { status: 201 },
    );
  } catch (error) {
    console.error("[admin/categories] POST error:", error);
    return buildError("INTERNAL", "Failed to create category", 500);
  }
}
