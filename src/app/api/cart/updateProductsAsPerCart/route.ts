import { isTokenVerified } from "@/json";
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "../../lib/dbconnection";
import { syncProductPrices } from "../../products/syncProductPrices";
import { logError } from "../../lib/logger";
import AsyncLock from "async-lock";

const lock = new AsyncLock({ timeout: 20000 });

export async function PUT(req: NextRequest) {
  try {
    const { items } = await req.json();
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");

    if (!userId || !Array.isArray(items)) {
      return NextResponse.json({ message: "Invalid input" }, { status: 400 });
    }

    return await lock.acquire(userId, async () => {
      const tokenVerificationResponse = await isTokenVerified(req);
      if (tokenVerificationResponse) return tokenVerificationResponse;

      const db = await connectDB(req);
      const productIds = items.map((item) => item?.productId).filter(Boolean);

      let latestProducts = [];
      try {
        latestProducts = await syncProductPrices(db, productIds);
      } catch (error) {
        logError("Error syncing cart products via Vertex:", error);
        return NextResponse.json(
          { error: "Failed to sync products" },
          { status: 500 },
        );
      }

      return NextResponse.json(
        {
          message: "Updated products as per cart successfully",
          data: latestProducts,
        },
        { status: 200 },
      );
    });
  } catch (error) {
    logError("Error in updateProductsAsPerCart:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 },
    );
  }
}
