import { NextResponse } from "next/server";
import { connectDB } from "@/app/api/lib/dbconnection";
import { requireAdmin } from "@/app/api/admin/requireAdmin";
import type { StoreConfig } from "@/app/api/store/storeConfigTypes";
import {
  getStoreConfig,
  normalizeStoreConfig,
  saveStoreConfig,
  validateStoreConfigInput,
} from "@/app/api/store/storeConfigUtils";

function buildError(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export async function GET(req: Request) {
  const authError = await requireAdmin(req);
  if (authError) return authError;

  try {
    const db = await connectDB(req);
    const storeConfig = await getStoreConfig(db);
    return NextResponse.json({
      storeConfig: normalizeStoreConfig(storeConfig),
    });
  } catch (error) {
    console.error("[admin/store-config] GET error:", error);
    return buildError("INTERNAL", "Failed to fetch store config", 500);
  }
}

export async function PUT(req: Request) {
  const authError = await requireAdmin(req);
  if (authError) return authError;

  try {
    const body = (await req.json()) as Partial<StoreConfig>;
    const validation = validateStoreConfigInput(body);
    if (!validation.valid) {
      return buildError("VALIDATION", validation.message ?? "Invalid input", 400);
    }

    const db = await connectDB(req);
    const current = await getStoreConfig(db);
    const merged = normalizeStoreConfig({
      ...current,
      storeHours: { ...current.storeHours, ...body.storeHours },
      deliveryRadius: { ...current.deliveryRadius, ...body.deliveryRadius },
      acceptingOrders:
        body.acceptingOrders !== undefined
          ? body.acceptingOrders
          : current.acceptingOrders,
    });
    await saveStoreConfig(db, merged);

    return NextResponse.json({ storeConfig: merged });
  } catch (error) {
    console.error("[admin/store-config] PUT error:", error);
    return buildError("INTERNAL", "Failed to update store config", 500);
  }
}
