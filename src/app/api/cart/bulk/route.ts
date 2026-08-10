import { ObjectId } from "mongodb";
import { NextRequest, NextResponse } from "next/server";
import type { ClientSession } from "mongodb";
import { CartItem } from "@/types/api";
import {
  abortTransaction,
  commitTransaction,
  connectDB,
  getClient,
  startTransaction,
} from "../../lib/dbconnection";
import { applyOffersToCart } from "../../offers/applyOffers";
import { logError } from "../../lib/logger";
import AsyncLock from "async-lock";
import { requireSameUser } from "@/app/api/lib/requireAuth";
import { clampCartQuantity } from "@/app/api/utils/secureCart";

const lock = new AsyncLock({ timeout: 20000 });

export async function PUT(req: NextRequest) {
  let session: ClientSession | undefined;
  try {
    const { items } = await req.json();
    const { searchParams } = new URL(req.url);
    const requestedUserId = searchParams.get("userId");

    if (!requestedUserId || !Array.isArray(items)) {
      return NextResponse.json({ message: "Invalid input" }, { status: 400 });
    }

    const auth = await requireSameUser(req, requestedUserId);
    if (auth instanceof NextResponse) return auth;
    const userId = auth.userId;

    const failedItems: { productId: string; reason: string }[] = [];

    return await lock.acquire(userId, async () => {
      const db = await connectDB(req);
      const client = await getClient();
      session = await startTransaction(client);

      const userObjectId = new ObjectId(userId);
      let cart = await db
        .collection("carts")
        .findOne({ userId: userObjectId }, { session });

      if (!cart) {
        await db
          .collection("carts")
          .insertOne({ userId: userObjectId, items: [] }, { session });
        cart = await db
          .collection("carts")
          .findOne({ userId: userObjectId }, { session });
      }

      let updatedItems: CartItem[] = [];

      for (const item of items) {
        const { productId, quantity } = item;

        if (
          !ObjectId.isValid(productId) ||
          typeof quantity !== "number" ||
          quantity < 0
        ) {
          failedItems.push({ productId, reason: "Invalid Input" });
          continue;
        }

        const productObjectId = new ObjectId(productId);
        // Read outside cart transaction so JioMart sync writes are always visible.
        const product = await db
          .collection("products")
          .findOne({ _id: productObjectId });

        if (!product) {
          failedItems.push({ productId, reason: "Not Found" });
          continue;
        }

        if (product.isOutOfStock) {
          failedItems.push({ productId, reason: "Out of Stock" });
          continue;
        }

        if ((product as { promoOnly?: boolean }).promoOnly) {
          failedItems.push({ productId, reason: "Promo only" });
          continue;
        }

        const safeQuantity = clampCartQuantity(
          quantity,
          product.maxQuantity as number | undefined,
        );

        if (safeQuantity === 0) {
          continue;
        }

        const itemIndex = updatedItems.findIndex((i) =>
          i.productId.equals(productObjectId),
        );
        if (itemIndex === -1) {
          updatedItems.push({
            productId: productObjectId,
            quantity: safeQuantity,
            productDetails: product,
          } as CartItem);
        } else {
          updatedItems[itemIndex].quantity = safeQuantity;
          updatedItems[itemIndex].productDetails = product;
        }
      }

      // Client sends paid lines only; strip any promo metadata if present
      updatedItems = updatedItems.filter(
        (item) => !(item as { isPromoFreebie?: boolean }).isPromoFreebie,
      );

      const { items: finalItems, orderDiscount } = await applyOffersToCart(
        db,
        updatedItems,
      );

      await db
        .collection("carts")
        .updateOne(
          { userId: userObjectId },
          { $set: { items: finalItems } },
          { session },
        );

      await commitTransaction(session);

      return NextResponse.json(
        {
          message: "Cart updated successfully",
          failedItems,
          orderDiscount,
        },
        { status: 200 },
      );
    });
  } catch (error) {
    if (session) await abortTransaction(session);
    logError("Error in bulk updateCart:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 },
    );
  }
}
