import { NextResponse } from "next/server";
import { connectDB } from "@/app/api/lib/dbconnection";
import { requireAdmin } from "@/app/api/admin/requireAdmin";
import {
  enrichJiomartSyncCategories,
  listJiomartSyncCategories,
  resolveSyncCategories,
  syncJiomartCategories,
} from "@/app/api/products/jiomartSync";

function buildError(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export async function GET(req: Request) {
  const authError = await requireAdmin(req);
  if (authError) return authError;

  try {
    const { searchParams } = new URL(req.url);
    const withCounts = searchParams.get("withCounts") !== "false";

    if (!withCounts) {
      const categories = listJiomartSyncCategories();
      return NextResponse.json({
        total: categories.length,
        syncAvailableCount: categories.filter((c) => c.syncAvailable).length,
        categories,
      });
    }

    const db = await connectDB(req);
    const categories = await enrichJiomartSyncCategories(db);

    return NextResponse.json({
      total: categories.length,
      syncAvailableCount: categories.filter((c) => c.syncAvailable).length,
      categories,
    });
  } catch (error) {
    console.error("[admin/products/jiomart-sync] GET error:", error);
    return buildError("INTERNAL", "Failed to list JioMart sync categories", 500);
  }
}

export async function POST(req: Request) {
  const authError = await requireAdmin(req);
  if (authError) return authError;

  try {
    const body = await req.json();
    const resolved = resolveSyncCategories({
      categories: body.categories,
      syncAll: Boolean(body.syncAll),
    });

    if (!resolved.valid) {
      return buildError("VALIDATION", resolved.message, 400);
    }

    const wipeAll = Boolean(body.wipeAll);
    const db = await connectDB(req);
    const result = await syncJiomartCategories(db, {
      categories: resolved.categories,
      wipeAll,
    });

    const failed = result.results.filter((r) => r.error);
    const succeeded = result.results.filter((r) => !r.error);

    return NextResponse.json(
      {
        ...result,
        summary: {
          requested: result.requested.length,
          succeeded: succeeded.length,
          failed: failed.length,
        },
      },
      { status: failed.length === result.results.length ? 422 : 200 },
    );
  } catch (error) {
    console.error("[admin/products/jiomart-sync] POST error:", error);
    return buildError(
      "INTERNAL",
      error instanceof Error ? error.message : "Sync failed",
      500,
    );
  }
}
