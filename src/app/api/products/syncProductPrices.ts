import { ObjectId } from "mongodb";
import { invalidateProductCache } from "../admin/products/productUtils";
import { fetchVertexProductPricingBatch } from "./jiomartVertex";
import { invalidateVertexPricingCache } from "./vertexPricingCache";
import { log } from "../lib/logger";

type SyncResult = {
  productId: string;
  status: string;
  name: string;
  oldPrice?: number;
  newPrice?: number;
  oldDiscountedPrice?: number;
  newDiscountedPrice?: number;
  oldMaxQuantity?: number;
  newMaxQuantity?: number;
  oldIsOutOfStock?: boolean;
  newIsOutOfStock?: boolean;
  error?: string;
};

export async function syncProductPrices(
  db: Awaited<ReturnType<typeof import("../lib/dbconnection").connectDB>>,
  productIds: string[],
) {
  const results: SyncResult[] = [];

  if (!productIds.length) {
    return results;
  }

  const objectIds = productIds.map((id) => new ObjectId(id));
  const existingProducts = await db
    .collection("products")
    .find({ _id: { $in: objectIds } })
    .toArray();

  const jiomartUids = existingProducts
    .map((p) => p.jiomartUid)
    .filter((uid): uid is string => Boolean(uid));

  await invalidateVertexPricingCache(jiomartUids);

  const pricingResults = await fetchVertexProductPricingBatch(
    existingProducts.map((p) => ({
      name: p.name,
      jiomartUid: p.jiomartUid,
      jiomartSlug: p.jiomartSlug,
    })),
  );

  for (let i = 0; i < existingProducts.length; i++) {
    const existingProduct = existingProducts[i];
    try {
      const vertexData = pricingResults[i];

      if (!vertexData?.matched) {
        await db
          .collection("products")
          .updateOne(
            { _id: existingProduct._id },
            { $set: { isOutOfStock: true } },
          );

        results.push({
          productId: existingProduct._id.toString(),
          status: "not_found_in_jioMart",
          name: existingProduct.name,
          oldIsOutOfStock: existingProduct.isOutOfStock,
          newIsOutOfStock: true,
          error: "Product not found in JioMart Vertex search",
        });

        log("[cart-sync] syncProductPrices:not_found", {
          productId: existingProduct._id.toString(),
          name: existingProduct.name,
          jiomartUid: existingProduct.jiomartUid ?? null,
        });
        continue;
      }

      const updateFields: Record<string, unknown> = {
        isOutOfStock: Boolean(vertexData.isOutOfStock),
        lastUpdated: new Date(),
      };

      if (vertexData.maxQuantity != null) {
        updateFields.maxQuantity = vertexData.maxQuantity;
      }

      log("[cart-sync] syncProductPrices:update", {
        productId: existingProduct._id.toString(),
        name: existingProduct.name,
        oldMaxQuantity: existingProduct.maxQuantity ?? null,
        newMaxQuantity: vertexData.maxQuantity ?? null,
        maxQuantityWritten: updateFields.maxQuantity ?? "unchanged",
        isOutOfStock: vertexData.isOutOfStock,
      });

      if (vertexData.price && vertexData.discountedPrice) {
        updateFields.price = vertexData.price;
        updateFields.discountedPrice = vertexData.discountedPrice;

        const priceChanged =
          existingProduct.price !== vertexData.price ||
          existingProduct.discountedPrice !== vertexData.discountedPrice;

        log("[jiomart] DB price sync", {
          productId: existingProduct._id.toString(),
          jiomartUid: existingProduct.jiomartUid ?? null,
          name: existingProduct.name,
          dbBefore: {
            mrp: existingProduct.price,
            sellingPrice: existingProduct.discountedPrice,
          },
          jiomartLatest: {
            mrp: vertexData.price,
            sellingPrice: vertexData.discountedPrice,
          },
          priceChanged,
        });
      } else {
        log("[jiomart] price not returned from JioMart — keeping DB price", {
          productId: existingProduct._id.toString(),
          jiomartUid: existingProduct.jiomartUid ?? null,
          name: existingProduct.name,
          dbPrice: existingProduct.price,
          dbDiscountedPrice: existingProduct.discountedPrice,
        });
      }

      await db
        .collection("products")
        .updateOne({ _id: existingProduct._id }, { $set: updateFields });

      results.push({
        productId: existingProduct._id.toString(),
        status: "updated",
        name: existingProduct.name,
        oldPrice: existingProduct.price,
        newPrice: vertexData.price ?? existingProduct.price,
        oldDiscountedPrice: existingProduct.discountedPrice,
        newDiscountedPrice:
          vertexData.discountedPrice ?? existingProduct.discountedPrice,
        oldMaxQuantity: existingProduct.maxQuantity,
        newMaxQuantity: vertexData.maxQuantity ?? existingProduct.maxQuantity,
        oldIsOutOfStock: existingProduct.isOutOfStock,
        newIsOutOfStock: vertexData.isOutOfStock,
      });
    } catch (error) {
      results.push({
        productId: existingProduct._id.toString(),
        status: "error",
        name: existingProduct.name,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const hadUpdates = results.some(
    (r) => r.status === "updated" || r.status === "not_found_in_jioMart",
  );
  if (hadUpdates) {
    await invalidateProductCache();
    log("[cart-sync] syncProductPrices:redis invalidated", {
      productListKeys: "products:*",
      updatedCount: results.filter((r) => r.status === "updated").length,
      notFoundCount: results.filter((r) => r.status === "not_found_in_jioMart")
        .length,
    });
  }

  return results;
}
