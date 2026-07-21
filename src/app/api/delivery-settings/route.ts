import { NextResponse } from "next/server";
import { connectDB } from "@/app/api/lib/dbconnection";
import {
  getDeliverySettings,
  normalizeDeliverySettingsForResponse,
} from "@/app/api/delivery/deliverySettingsUtils";
import { isTokenVerified } from "@/json";
import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const tokenVerificationResponse = await isTokenVerified(req);
    if (tokenVerificationResponse) {
      return tokenVerificationResponse;
    }
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
