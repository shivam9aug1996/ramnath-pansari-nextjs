import { NextResponse } from "next/server";
import { connectDB } from "@/app/api/lib/dbconnection";
import { requireAdmin } from "@/app/api/admin/requireAdmin";
import type { SyncVersions } from "@/app/api/app/syncVersionsTypes";
import {
  getSyncVersions,
  setSyncVersions,
  validateSyncVersionsInput,
} from "@/app/api/app/syncVersionsUtils";

function buildError(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export async function GET(req: Request) {
  const authError = await requireAdmin(req);
  if (authError) return authError;

  try {
    const db = await connectDB(req);
    const syncVersions = await getSyncVersions(db);
    return NextResponse.json({ syncVersions });
  } catch (error) {
    console.error("[admin/sync-versions] GET error:", error);
    return buildError("INTERNAL", "Failed to fetch sync versions", 500);
  }
}

export async function PUT(req: Request) {
  const authError = await requireAdmin(req);
  if (authError) return authError;

  try {
    const body = (await req.json()) as Partial<SyncVersions>;
    const validation = validateSyncVersionsInput(body);
    if (!validation.valid) {
      return buildError("VALIDATION", validation.message, 400);
    }

    const db = await connectDB(req);
    const syncVersions = await setSyncVersions(db, validation.versions);
    return NextResponse.json({ syncVersions });
  } catch (error) {
    console.error("[admin/sync-versions] PUT error:", error);
    return buildError("INTERNAL", "Failed to update sync versions", 500);
  }
}
