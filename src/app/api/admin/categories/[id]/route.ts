import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { connectDB } from "@/app/api/lib/dbconnection";
import { requireAdmin } from "@/app/api/admin/requireAdmin";
import { bumpSyncVersion } from "@/app/api/app/syncVersionsUtils";
import {
  CategoryNode,
  countCategoryChildren,
  findCategoryById,
  findCategoryPath,
  findRootDocForCategoryId,
  normalizeSingleCategory,
  removeCategoryFromTree,
  updateCategoryInTree,
} from "@/app/api/admin/categories/categoryUtils";

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
      return buildError("VALIDATION", "Invalid category id", 400);
    }

    const db = await connectDB(req);
    const roots = (await db.collection("categories").find({}).toArray()) as CategoryNode[];
    const category = findCategoryById(roots, id);

    if (!category) {
      return buildError("NOT_FOUND", "Category not found", 404);
    }

    const path = findCategoryPath(roots, id) ?? [];
    const parent = path.length > 1 ? path[path.length - 2] : null;

    return NextResponse.json({
      category: normalizeSingleCategory(category),
      parentId: parent ? parent._id.toString() : null,
      breadcrumb: path.map((node) => ({
        _id: node._id.toString(),
        name: node.name,
      })),
    });
  } catch (error) {
    console.error("[admin/categories/:id] GET error:", error);
    return buildError("INTERNAL", "Failed to fetch category", 500);
  }
}

export async function PUT(req: Request, context: RouteContext) {
  const authError = await requireAdmin(req);
  if (authError) return authError;

  try {
    const { id } = await context.params;
    if (!ObjectId.isValid(id)) {
      return buildError("VALIDATION", "Invalid category id", 400);
    }

    const body = await req.json();
    const name =
      body?.name !== undefined ? String(body.name).trim() : undefined;
    const image =
      body?.image !== undefined ? (body.image ? String(body.image) : null) : undefined;

    if (name !== undefined && !name) {
      return buildError("VALIDATION", "Category name cannot be empty", 400);
    }
    if (name === undefined && image === undefined) {
      return buildError("VALIDATION", "Nothing to update", 400);
    }

    const db = await connectDB(req);
    const located = await findRootDocForCategoryId(db, id);
    if (!located) {
      return buildError("NOT_FOUND", "Category not found", 404);
    }

    const { rootDoc, isRoot } = located;
    const patch = {
      ...(name !== undefined ? { name } : {}),
      ...(image !== undefined ? { image } : {}),
    };

    if (isRoot) {
      await db.collection("categories").updateOne(
        { _id: rootDoc._id },
        { $set: patch },
      );
      const updated = await db.collection("categories").findOne({ _id: rootDoc._id });
      await bumpSyncVersion(db, "category");
      return NextResponse.json({
        category: normalizeSingleCategory(updated as CategoryNode),
      });
    }

    const updatedChildren = updateCategoryInTree(rootDoc.children ?? [], id, patch);
    await db.collection("categories").updateOne(
      { _id: rootDoc._id },
      { $set: { children: updatedChildren } },
    );

    const updatedNode = findCategoryById(updatedChildren, id);
    if (!updatedNode) {
      return buildError("INTERNAL", "Failed to update category", 500);
    }

    await bumpSyncVersion(db, "category");

    return NextResponse.json({
      category: normalizeSingleCategory(updatedNode),
    });
  } catch (error) {
    console.error("[admin/categories/:id] PUT error:", error);
    return buildError("INTERNAL", "Failed to update category", 500);
  }
}

export async function DELETE(req: Request, context: RouteContext) {
  const authError = await requireAdmin(req);
  if (authError) return authError;

  try {
    const { id } = await context.params;
    if (!ObjectId.isValid(id)) {
      return buildError("VALIDATION", "Invalid category id", 400);
    }

    const db = await connectDB(req);
    const located = await findRootDocForCategoryId(db, id);
    if (!located) {
      return buildError("NOT_FOUND", "Category not found", 404);
    }

    const { rootDoc, isRoot } = located;
    const target = isRoot
      ? rootDoc
      : findCategoryById(rootDoc.children ?? [], id);

    if (!target) {
      return buildError("NOT_FOUND", "Category not found", 404);
    }

    if (countCategoryChildren(target) > 0) {
      return buildError(
        "CONFLICT",
        "Remove or reassign subcategories before deleting this category",
        409,
      );
    }

    const productCount = await db.collection("products").countDocuments({
      categoryPath: new ObjectId(id),
    });
    if (productCount > 0) {
      return buildError(
        "CONFLICT",
        `Cannot delete: ${productCount} product(s) are linked to this category`,
        409,
      );
    }

    if (isRoot) {
      await db.collection("categories").deleteOne({ _id: rootDoc._id });
    } else {
      const updatedChildren = removeCategoryFromTree(rootDoc.children ?? [], id);
      await db.collection("categories").updateOne(
        { _id: rootDoc._id },
        { $set: { children: updatedChildren } },
      );
    }

    await bumpSyncVersion(db, "category");

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[admin/categories/:id] DELETE error:", error);
    return buildError("INTERNAL", "Failed to delete category", 500);
  }
}
