import { NextResponse } from "next/server";
import { requireAdmin } from "@/app/api/admin/requireAdmin";
import { invalidateProductCache } from "@/app/api/admin/products/productUtils";

function buildError(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

/** Clears Redis product list cache keys only (`products:*`). */
export async function POST(req: Request) {
  const authError = await requireAdmin(req);
  if (authError) return authError;

  try {
    const result = await invalidateProductCache();
    return NextResponse.json({
      success: true,
      deleted: result.deleted,
      pattern: "products:*",
    });
  } catch (error) {
    console.error("[admin/redis/products] POST error:", error);
    return buildError("INTERNAL", "Failed to flush product Redis cache", 500);
  }
}
