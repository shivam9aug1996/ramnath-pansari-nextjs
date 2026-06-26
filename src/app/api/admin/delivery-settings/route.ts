import { NextResponse } from "next/server";
import { connectDB } from "@/app/api/lib/dbconnection";
import { requireAdmin } from "@/app/api/admin/requireAdmin";
import type { DeliverySettings } from "@/app/api/delivery/deliverySettingsTypes";
import {
  getDeliverySettings,
  normalizeDeliverySettings,
  saveDeliverySettings,
  validateDeliverySettingsInput,
} from "@/app/api/delivery/deliverySettingsUtils";

function buildError(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export async function GET(req: Request) {
  const authError = await requireAdmin(req);
  if (authError) return authError;

  try {
    const db = await connectDB(req);
    const deliverySettings = await getDeliverySettings(db);
    return NextResponse.json({
      deliverySettings: normalizeDeliverySettings(deliverySettings),
    });
  } catch (error) {
    console.error("[admin/delivery-settings] GET error:", error);
    return buildError("INTERNAL", "Failed to fetch delivery settings", 500);
  }
}

export async function PUT(req: Request) {
  const authError = await requireAdmin(req);
  if (authError) return authError;

  try {
    const body = (await req.json()) as Partial<DeliverySettings>;
    const validation = validateDeliverySettingsInput(body);
    if (!validation.valid) {
      return buildError("VALIDATION", validation.message ?? "Invalid input", 400);
    }

    const db = await connectDB(req);
    const current = await getDeliverySettings(db);
    const merged = normalizeDeliverySettings({ ...current, ...body });
    await saveDeliverySettings(db, merged);

    return NextResponse.json({
      deliverySettings: merged,
    });
  } catch (error) {
    console.error("[admin/delivery-settings] PUT error:", error);
    return buildError("INTERNAL", "Failed to update delivery settings", 500);
  }
}
