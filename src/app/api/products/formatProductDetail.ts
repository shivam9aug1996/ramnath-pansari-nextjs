type ProductDocument = {
  _id?: { toString(): string };
  name?: string;
  image?: string;
  price?: number;
  discountedPrice?: number;
  size?: string;
  category?: string;
  maxQuantity?: number;
  isOutOfStock?: boolean;
  jiomartUid?: string;
  jiomartSlug?: string;
  skuCode?: string;
  brand?: string;
  countryOfOrigin?: string;
  articleId?: string;
  foodType?: "veg" | "non-veg";
  categoryPath?: Array<{ toString(): string }>;
  createdAt?: Date;
  lastUpdated?: Date;
  [key: string]: unknown;
};

function formatVegNonVeg(foodType?: string): string | null {
  if (foodType === "veg") return "Veg";
  if (foodType === "non-veg") return "Non-Veg";
  return null;
}

function serializeProduct(product: ProductDocument) {
  const serialized: Record<string, unknown> = { ...product };

  if (product._id) {
    serialized._id = product._id.toString();
  }

  if (Array.isArray(product.categoryPath)) {
    serialized.categoryPath = product.categoryPath.map((id) => id.toString());
  }

  if (product.createdAt instanceof Date) {
    serialized.createdAt = product.createdAt.toISOString();
  }

  if (product.lastUpdated instanceof Date) {
    serialized.lastUpdated = product.lastUpdated.toISOString();
  }

  return serialized;
}

export function formatProductDetailResponse(product: ProductDocument | null) {
  if (!product) return null;

  const netQuantity = product.size ?? null;

  return {
    product: serializeProduct(product),
    productInformation: {
      brand: product.brand ?? null,
      countryOfOrigin: product.countryOfOrigin ?? null,
      articleId: product.articleId ?? product.skuCode ?? null,
      vegNonVeg: formatVegNonVeg(product.foodType) ?? null,
    },
    itemSpecifications: {
      netQuantity,
      productType: product.category ?? null,
    },
    images: product.image ? [product.image] : [],
  };
}
