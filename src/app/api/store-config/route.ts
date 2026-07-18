import { NextResponse } from "next/server";
import { connectDB } from "@/app/api/lib/dbconnection";
import {
  getStoreConfig,
  normalizeStoreConfig,
} from "@/app/api/store/storeConfigUtils";

export async function GET(req: Request) {
  try {
    const db = await connectDB(req);
    const storeConfig = await getStoreConfig(db);
    return NextResponse.json(
      { storeConfig: normalizeStoreConfig(storeConfig) },
      {
        status: 200,
      },
    );
  } catch (error) {
    console.error("[store-config] GET error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL", message: "Failed to fetch store config" } },
      { status: 500 },
    );
  }
}
