import { NextResponse } from "next/server";
import { connectDB } from "@/app/api/lib/dbconnection";
import {
  getDeliverySettings,
  normalizeDeliverySettingsForResponse,
} from "@/app/api/delivery/deliverySettingsUtils";

export async function GET(req: Request) {
  try {
    const db = await connectDB(req);
    const deliverySettings = await getDeliverySettings(db);
    return NextResponse.json(
      {
        deliverySettings: normalizeDeliverySettingsForResponse(deliverySettings),
      },
      {
        status: 200,
      },
    );
  } catch (error) {
    console.error("[delivery-settings] GET error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL", message: "Failed to fetch delivery settings" } },
      { status: 500 },
    );
  }
}
