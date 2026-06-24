import { isTokenVerified } from "@/json";
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "../../lib/dbconnection";
import { syncProductPrices } from "../../products/syncProductPrices";
import { logError } from "../../lib/logger";
import {
  acquireCheckoutHolds,
  releaseCheckoutHolds,
} from "../../utils/productPendingLock";
import AsyncLock from "async-lock";

const lock = new AsyncLock({ timeout: 20_000 });

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
      console.log("[product-lock] updateProductsAsPerCart:start", {
        userId,
        productIds,
      });

      let holdResult;
      try {
        holdResult = await acquireCheckoutHolds(userId, productIds);
      } catch (error) {
        logError("[product-lock] updateProductsAsPerCart:hold-error", error);
        return NextResponse.json(
          { error: "Failed to reserve products for checkout" },
          { status: 503 },
        );
      }

      if (!holdResult.ok) {
        console.log("[product-lock] updateProductsAsPerCart:held", {
          userId,
          heldProducts: holdResult.heldProducts,
        });
        return NextResponse.json(
          {
            message: "Some products are on hold for another order",
            heldProducts: holdResult.heldProducts,
            data: [],
          },
          { status: 409 },
        );
      }

      let latestProducts = [];
      try {
        latestProducts = await syncProductPrices(db, productIds);
      } catch (error) {
        await releaseCheckoutHolds(userId, productIds, "jiomart-sync-failed");
        logError("[product-lock] updateProductsAsPerCart:sync-error", error);
        return NextResponse.json(
          { error: "Failed to sync products" },
          { status: 500 },
        );
      }

      console.log("[product-lock] updateProductsAsPerCart:success", {
        userId,
        productIds,
        syncedCount: latestProducts.length,
      });

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
