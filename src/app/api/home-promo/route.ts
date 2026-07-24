import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { connectDB } from "@/app/api/lib/dbconnection";
import {
  getHomeProductPromo,
  toPublicHomePromo,
} from "@/app/api/home-promo/homePromoUtils";

export async function GET(req: NextRequest) {
  try {
    const db = await connectDB(req);
    const promo = await getHomeProductPromo(db);
    return NextResponse.json(
      { promo: toPublicHomePromo(promo) },
      { status: 200 },
    );
  } catch (error) {
    console.error("[home-promo] GET error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL", message: "Failed to fetch home promo" } },
      { status: 500 },
    );
  }
}
