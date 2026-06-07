import { ObjectId } from "mongodb";
import { fetchVertexProductPricingBatch } from "./jiomartVertex";
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
          error: "Product not found in JioMart Vertex search",
        });
        continue;
      }

      const updateFields: Record<string, unknown> = {
        maxQuantity: vertexData.maxQuantity,
        isOutOfStock: vertexData.isOutOfStock,
        lastUpdated: new Date(),
      };

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
        newMaxQuantity: vertexData.maxQuantity,
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

  return results;
}
