import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/app/api/lib/dbconnection";
import { isTokenVerified } from "@/json";
import {
  buildSyncStateResponse,
  buildGlobalFetchFlags,
  getSyncVersions,
} from "@/app/api/app/syncVersionsUtils";
import type { SyncStateClientVersions } from "@/app/api/app/syncVersionsTypes";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { client?: SyncStateClientVersions };
    const client = body?.client ?? {};
    const db = await connectDB(req);

    const authError = await isTokenVerified(req);
    if (authError) {
      const server = await getSyncVersions(db);
      const fetch = buildGlobalFetchFlags(client, server);
      return NextResponse.json(
        {
          server,
          fetch: {
            ...fetch,
            offers: false,
            deliverySettings: false,
            storeConfig: false,
            category: false,
          },
        },
        { status: 200 },
      );
    }

    const response = await buildSyncStateResponse(db, client);

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error("[sync-state] POST error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL", message: "Failed to build sync state" } },
      { status: 500 },
    );
  }
}
