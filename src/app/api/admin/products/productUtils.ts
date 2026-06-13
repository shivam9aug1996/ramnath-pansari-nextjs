import { ObjectId } from "mongodb";
import {
  CategoryNode,
  findCategoryPath,
} from "@/app/api/admin/categories/categoryUtils";

export type ProductDocument = {
  _id?: ObjectId;
  name?: string;
  image?: string | null;
  price?: number;
  discountedPrice?: number;
  size?: string;
  category?: string;
  maxQuantity?: number;
  isOutOfStock?: boolean;
  brand?: string;
  countryOfOrigin?: string;
  articleId?: string;
  foodType?: "veg" | "non-veg";
  skuCode?: string;
  jiomartUid?: string;
  jiomartSlug?: string;
  isSmartBazaar?: boolean;
  categoryPath?: ObjectId[];
  createdAt?: Date;
  lastUpdated?: Date;
  isDeleted?: boolean;
  [key: string]: unknown;
};

export type NormalizedProduct = {
  _id: string;
  name: string;
  image: string | null;
  price: number;
  discountedPrice: number;
  size: string;
  categoryPath: string[];
  category?: string;
  maxQuantity?: number;
  isOutOfStock: boolean;
  brand?: string;
  foodType?: "veg" | "non-veg";
  skuCode?: string;
  jiomartUid?: string;
  createdAt?: string;
  lastUpdated?: string;
};

function toIso(value: unknown) {
  try {
    if (!value) return undefined;
    const d = new Date(value as string | Date);
    return isNaN(d.getTime()) ? undefined : d.toISOString();
  } catch {
    return undefined;
  }
}

export function normalizeProductForResponse(
  product: ProductDocument | null,
): NormalizedProduct | null {
  if (!product) return null;

  return {
    _id: product._id?.toString() ?? "",
    name: String(product.name ?? ""),
    image: product.image ?? null,
    price: Number(product.price ?? 0),
    discountedPrice: Number(product.discountedPrice ?? 0),
    size: String(product.size ?? ""),
    categoryPath: Array.isArray(product.categoryPath)
      ? product.categoryPath.map((id) => id.toString())
      : [],
    category: product.category ? String(product.category) : undefined,
    maxQuantity:
      product.maxQuantity != null ? Number(product.maxQuantity) : undefined,
    isOutOfStock: Boolean(product.isOutOfStock),
    brand: product.brand ? String(product.brand) : undefined,
    foodType: product.foodType,
    skuCode: product.skuCode ? String(product.skuCode) : undefined,
    jiomartUid: product.jiomartUid ? String(product.jiomartUid) : undefined,
    createdAt: toIso(product.createdAt),
    lastUpdated: toIso(product.lastUpdated),
  };
}

export function buildProductSearchFilter(search: string) {
  if (!search.trim()) return {};
  const regex = { $regex: search.trim(), $options: "i" };
  return {
    $or: [
      { name: regex },
      { skuCode: regex },
      { jiomartUid: regex },
      { brand: regex },
      { category: regex },
    ],
  };
}

export function buildProductListFilter(params: {
  categoryId?: string;
  stock?: string;
}) {
  const filter: Record<string, unknown> = { isDeleted: { $ne: true } };

  if (params.categoryId && ObjectId.isValid(params.categoryId)) {
    filter.categoryPath = new ObjectId(params.categoryId);
  }

  if (params.stock === "in_stock") {
    filter.isOutOfStock = { $ne: true };
  } else if (params.stock === "out_of_stock") {
    filter.isOutOfStock = true;
  } else if (params.stock === "hidden") {
    filter.discountedPrice = 0;
  }

  return filter;
}

export function validateProductInput(body: Record<string, unknown>) {
  const name = String(body.name ?? "").trim();
  const size = String(body.size ?? "").trim();
  const price = Number(body.price);
  const discountedPrice = Number(body.discountedPrice);
  const categoryPath = body.categoryPath;

  if (!name) return { valid: false, message: "Product name is required" };
  if (!size) return { valid: false, message: "Size is required" };
  if (!Number.isFinite(price) || price < 0) {
    return { valid: false, message: "Valid MRP is required" };
  }
  if (!Number.isFinite(discountedPrice) || discountedPrice < 0) {
    return { valid: false, message: "Valid selling price is required" };
  }
  if (!Array.isArray(categoryPath) || categoryPath.length === 0) {
    return { valid: false, message: "Category is required" };
  }
  for (const id of categoryPath) {
    if (!ObjectId.isValid(String(id))) {
      return { valid: false, message: "Invalid category in categoryPath" };
    }
  }

  return { valid: true, name, size, price, discountedPrice };
}

export async function resolveCategoryPathFromLeafId(
  db: { collection: (name: string) => { find: Function } },
  leafCategoryId: string,
): Promise<ObjectId[] | null> {
  const roots = (await db.collection("categories").find({}).toArray()) as CategoryNode[];
  const path = findCategoryPath(roots, leafCategoryId);
  if (!path?.length) return null;
  return path.map((node) => node._id);
}

export function buildProductWritePayload(
  body: Record<string, unknown>,
  categoryPath: ObjectId[],
) {
  const now = new Date();
  const payload: ProductDocument = {
    name: String(body.name).trim(),
    size: String(body.size).trim(),
    price: Number(body.price),
    discountedPrice: Number(body.discountedPrice),
    categoryPath,
    image: body.image ? String(body.image) : null,
    isOutOfStock: Boolean(body.isOutOfStock),
    lastUpdated: now,
  };

  if (body.maxQuantity != null && body.maxQuantity !== "") {
    payload.maxQuantity = Number(body.maxQuantity);
  }
  if (body.brand) payload.brand = String(body.brand);
  if (body.category) payload.category = String(body.category);
  if (body.foodType === "veg" || body.foodType === "non-veg") {
    payload.foodType = body.foodType;
  }

  return payload;
}

export async function invalidateProductCache() {
  try {
    const RedisClient = (await import("@/app/api/lib/redisClient")).default;
    const redis = await RedisClient.getInstance();
    const keys = await redis.keys("products:*");
    if (keys.length > 0) await redis.del(keys);
  } catch {
    // Redis optional
  }
}
