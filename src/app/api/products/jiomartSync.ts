import { ObjectId, type Db } from "mongodb";
import categoryConfig from "./categoryConfig";
import { fetchVertexProducts, transformVertexProducts } from "./jiomartVertex";
import { invalidateProductCache } from "@/app/api/admin/products/productUtils";
import { log, logError } from "../lib/logger";

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

  if (wipeAll) {
    await db.collection("products").deleteMany({ productFromJio: true });
    await db.collection("carts").updateMany({}, { $set: { items: [] } });
    await flushProductListRedisCache();
  }

  for (const categoryName of options.categories) {
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

      const vertexItems = await fetchVertexProducts(config.vertex);
      if (!vertexItems.length) {
        throw new Error("No products found in JioMart response");
      }

      const categoryPath = await getCategoryPath(db, categoryName);
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

      log(
        `Fetched ${vertexItems.length} items, transformed ${transformedProducts.length} products for ${categoryName}`,
      );

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
        }
      } else {
        for (const product of transformedProducts) {
          const existing = await db.collection("products").findOne({
            jiomartUid: product.jiomartUid,
          });
          if (existing && existing.productFromJio === false) {
            continue;
          }

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
        }
      }

      const categoryProducts = await db
        .collection("products")
        .find({
          categoryPath: {
            $all: categoryPath.map((id) => new ObjectId(id)),
          },
        })
        .toArray();

      results.push({
        category: categoryName,
        syncedProducts: transformedProducts.length,
        totalProducts: categoryProducts.length,
      });

      log(`Updated ${categoryName}: ${categoryProducts.length} products`);
    } catch (error) {
      logError(`Error processing ${categoryName}:`, error);
      results.push({
        category: categoryName,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  await flushProductListRedisCache();

  return {
    message: "Categories sync completed",
    wipeAll,
    requested: options.categories,
    results,
  };
}
