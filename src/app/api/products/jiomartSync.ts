import { ObjectId, type Db } from "mongodb";
import categoryConfig from "./categoryConfig";
import { fetchVertexProducts, transformVertexProducts } from "./jiomartVertex";
import { invalidateProductCache } from "@/app/api/admin/products/productUtils";
import { log, logError } from "../lib/logger";

/** Always prints — needed for Vercel/prod sync debugging (`log` is dev-only). */
function syncLog(message: string, data?: Record<string, unknown>) {
  if(process.env.NODE_ENV === "production") {
    return;
  }
  if (data) {
    console.log(message, data);
  } else {
    console.log(message);
  }
}

export type JiomartSyncCategoryInfo = {
  name: string;
  syncAvailable: boolean;
  vertex?: {
    l1Category: string;
    l2Category: string;
    l3Category: string;
  };
  productCount: number;
  storeCategoryFound: boolean;
};

export type JiomartSyncCategoryResult = {
  category: string;
  syncedProducts?: number;
  totalProducts?: number;
  error?: string;
};

export type JiomartSyncResult = {
  message: string;
  wipeAll: boolean;
  requested: string[];
  results: JiomartSyncCategoryResult[];
};

type CategoryDoc = {
  _id?: { toString(): string };
  name: string;
  children?: CategoryDoc[];
};

export function listJiomartSyncCategories(): Omit<
  JiomartSyncCategoryInfo,
  "productCount" | "storeCategoryFound"
>[] {
  return Object.entries(categoryConfig).map(([name, config]) => {
    const vertex =
      "vertex" in config && config.vertex ? config.vertex : undefined;
    return {
      name,
      syncAvailable: Boolean(vertex),
      vertex,
    };
  });
}

export function resolveSyncCategories(input: {
  categories?: string[];
  syncAll?: boolean;
}): { valid: true; categories: string[] } | { valid: false; message: string } {
  const allNames = Object.keys(categoryConfig);

  if (input.syncAll) {
    return { valid: true, categories: allNames };
  }

  const requested = (input.categories ?? [])
    .map((name) => String(name).trim())
    .filter(Boolean);

  if (!requested.length) {
    return {
      valid: false,
      message: "Provide categories array or set syncAll to true",
    };
  }

  const invalid = requested.filter(
    (name) => !allNames.includes(name as keyof typeof categoryConfig),
  );
  if (invalid.length) {
    return {
      valid: false,
      message: `Unknown categories: ${invalid.join(", ")}`,
    };
  }

  return { valid: true, categories: requested };
}

export async function getCategoryPath(
  db: Db,
  categoryName: string,
): Promise<string[]> {
  const findPath = async (
    categories: CategoryDoc[],
    targetName: string,
    currentPath: string[] = [],
  ): Promise<string[] | null> => {
    for (const category of categories) {
      if (category.name === targetName) {
        const idStr = category._id?.toString();
        return idStr ? [...currentPath, idStr] : null;
      }

      if (category.children && category.children.length > 0) {
        const idStr = category._id?.toString();
        const path = await findPath(
          category.children,
          targetName,
          idStr ? [...currentPath, idStr] : currentPath,
        );
        if (path) return path;
      }
    }
    return null;
  };

  const categories = (await db
    .collection("categories")
    .find({})
    .toArray()) as unknown as CategoryDoc[];

  const path = await findPath(categories, categoryName);
  if (!path) {
    throw new Error(`Category path not found for: ${categoryName}`);
  }

  return path;
}

async function flushProductListRedisCache() {
  try {
    await invalidateProductCache();
  } catch (error) {
    log("Redis products:* flush skipped:", error);
  }
}

export async function enrichJiomartSyncCategories(
  db: Db,
): Promise<JiomartSyncCategoryInfo[]> {
  const base = listJiomartSyncCategories();
  const storeCategories = (await db
    .collection("categories")
    .find({})
    .toArray()) as unknown as CategoryDoc[];

  const storeNames = new Set<string>();
  const walk = (nodes: CategoryDoc[]) => {
    for (const node of nodes) {
      storeNames.add(node.name);
      if (node.children?.length) walk(node.children);
    }
  };
  walk(storeCategories);

  const counts = await Promise.all(
    base.map(async (item) => {
      const productCount = await db.collection("products").countDocuments({
        category: item.name,
        isDeleted: { $ne: true },
      });
      return {
        ...item,
        productCount,
        storeCategoryFound: storeNames.has(item.name),
      };
    }),
  );

  return counts;
}

export async function syncJiomartCategories(
  db: Db,
  options: { categories: string[]; wipeAll?: boolean },
): Promise<JiomartSyncResult> {
  const wipeAll = Boolean(options.wipeAll);
  const results: JiomartSyncCategoryResult[] = [];
  const startedAt = Date.now();

  syncLog("[jiomart-sync] start", {
    wipeAll,
    categoryCount: options.categories.length,
    categories: options.categories,
  });

  if (wipeAll) {
    const beforeJioCount = await db.collection("products").countDocuments({
      productFromJio: true,
    });
    const deleteResult = await db
      .collection("products")
      .deleteMany({ productFromJio: true });
    await db.collection("carts").updateMany({}, { $set: { items: [] } });
    await flushProductListRedisCache();
    syncLog("[jiomart-sync] wipeAll done", {
      jioProductsBefore: beforeJioCount,
      deleted: deleteResult.deletedCount,
    });
  }

  for (const categoryName of options.categories) {
    const categoryStartedAt = Date.now();
    try {
      const config =
        categoryConfig[categoryName as keyof typeof categoryConfig];
      if (!config) {
        throw new Error(`Invalid category name: ${categoryName}`);
      }

      if (!("vertex" in config) || !config.vertex) {
        throw new Error(
          `No JioMart Vertex mapping for category: ${categoryName}`,
        );
      }

      syncLog("[jiomart-sync] category start", {
        category: categoryName,
        vertex: config.vertex,
      });

      const vertexItems = await fetchVertexProducts(config.vertex);
      syncLog("[jiomart-sync] vertex fetch", {
        category: categoryName,
        vertexItemCount: vertexItems.length,
        sampleUids: vertexItems.slice(0, 5).map((item) => item.uid),
      });

      if (!vertexItems.length) {
        throw new Error("No products found in JioMart response");
      }

      const categoryPath = await getCategoryPath(db, categoryName);
      syncLog("[jiomart-sync] category path", {
        category: categoryName,
        categoryPath,
      });

      const existingInCategory = await db.collection("products").countDocuments({
        productFromJio: true,
        category: categoryName,
      });

      const transformedProducts = (
        await transformVertexProducts(
          vertexItems,
          categoryName,
          config.vertex,
        )
      ).map((product) => ({
        ...product,
        categoryPath: categoryPath.map((id) => new ObjectId(id)),
      }));

      syncLog("[jiomart-sync] transform", {
        category: categoryName,
        vertexItemCount: vertexItems.length,
        transformedCount: transformedProducts.length,
        droppedFromTransform: vertexItems.length - transformedProducts.length,
        existingJioInCategory: existingInCategory,
        sample: transformedProducts.slice(0, 3).map((product) => ({
          jiomartUid: product.jiomartUid,
          name: product.name,
          price: product.price,
          discountedPrice: product.discountedPrice,
          size: product.size,
        })),
      });

      let upserted = 0;
      let skippedManual = 0;
      let inserted = 0;

      if (wipeAll) {
        if (transformedProducts.length) {
          await db.collection("products").insertMany(
            transformedProducts.map((product) => ({
              ...product,
              _id: new ObjectId(),
              productFromJio: true,
              promoOnly: false,
              createdAt: new Date(),
              lastUpdated: new Date(),
            })),
          );
          inserted = transformedProducts.length;
        }
        syncLog("[jiomart-sync] wipeAll insert", {
          category: categoryName,
          inserted,
        });
      } else {
        for (const product of transformedProducts) {
          const existing = await db.collection("products").findOne({
            jiomartUid: product.jiomartUid,
          });
          if (existing && existing.productFromJio === false) {
            skippedManual += 1;
            syncLog("[jiomart-sync] skip manual product", {
              category: categoryName,
              jiomartUid: product.jiomartUid,
              name: product.name,
            });
            continue;
          }

          const wasInsert = !existing;
          await db.collection("products").updateOne(
            { jiomartUid: product.jiomartUid },
            {
              $set: {
                ...product,
                productFromJio: true,
                lastUpdated: new Date(),
              },
              $setOnInsert: {
                _id: new ObjectId(),
                createdAt: new Date(),
                promoOnly: false,
              },
            },
            { upsert: true },
          );
          upserted += 1;
          if (wasInsert) inserted += 1;
        }
        syncLog("[jiomart-sync] upsert summary", {
          category: categoryName,
          upserted,
          inserted,
          updated: upserted - inserted,
          skippedManual,
        });
      }

      // Leftovers: JioMart products in this category that were not in this fetch → OOS
      const fetchedUids = transformedProducts.map(
        (product) => product.jiomartUid,
      );
      const orphanFilter = {
        productFromJio: true,
        category: categoryName,
        jiomartUid: { $nin: fetchedUids },
      };
      const orphansBefore = await db
        .collection("products")
        .find(orphanFilter, {
          projection: {
            name: 1,
            jiomartUid: 1,
            price: 1,
            discountedPrice: 1,
            isOutOfStock: 1,
          },
        })
        .limit(20)
        .toArray();
      const orphanCountBefore = await db
        .collection("products")
        .countDocuments(orphanFilter);

      const orphanResult = await db.collection("products").updateMany(
        orphanFilter,
        {
          $set: {
            isOutOfStock: true,
            lastUpdated: new Date(),
          },
        },
      );

      syncLog("[jiomart-sync] orphans", {
        category: categoryName,
        fetchedUidCount: fetchedUids.length,
        orphanCountBefore,
        matched: orphanResult.matchedCount,
        modified: orphanResult.modifiedCount,
        sample: orphansBefore.map((product) => ({
          jiomartUid: product.jiomartUid,
          name: product.name,
          price: product.price,
          discountedPrice: product.discountedPrice,
          wasAlreadyOos: product.isOutOfStock,
        })),
      });

      const categoryProducts = await db
        .collection("products")
        .find({
          categoryPath: {
            $all: categoryPath.map((id) => new ObjectId(id)),
          },
        })
        .toArray();

      const jioInCategory = categoryProducts.filter(
        (product) => product.productFromJio === true,
      ).length;
      const oosInCategory = categoryProducts.filter(
        (product) => product.isOutOfStock === true,
      ).length;

      results.push({
        category: categoryName,
        syncedProducts: transformedProducts.length,
        totalProducts: categoryProducts.length,
      });

      syncLog("[jiomart-sync] category done", {
        category: categoryName,
        syncedProducts: transformedProducts.length,
        totalProducts: categoryProducts.length,
        jioInCategory,
        oosInCategory,
        leftoverEstimate: Math.max(
          0,
          categoryProducts.length - transformedProducts.length,
        ),
        durationMs: Date.now() - categoryStartedAt,
      });
    } catch (error) {
      logError(`[jiomart-sync] category failed: ${categoryName}`, error);
      results.push({
        category: categoryName,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  await flushProductListRedisCache();

  const succeeded = results.filter((row) => !row.error).length;
  const failed = results.filter((row) => row.error).length;
  syncLog("[jiomart-sync] complete", {
    wipeAll,
    succeeded,
    failed,
    durationMs: Date.now() - startedAt,
    results: results.map((row) =>
      row.error
        ? { category: row.category, error: row.error }
        : {
            category: row.category,
            synced: row.syncedProducts,
            total: row.totalProducts,
          },
    ),
  });

  return {
    message: "Categories sync completed",
    wipeAll,
    requested: options.categories,
    results,
  };
}
