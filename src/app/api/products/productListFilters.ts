import { Filter, Document, Sort } from "mongodb";

export type ProductListSort =
  | "relevance"
  | "price_asc"
  | "price_desc"
  | "name_asc";

export type ParsedProductFilters = {
  brands: string[];
  sort: ProductListSort;
  inStockOnly: boolean;
  priceMin: number | null;
  priceMax: number | null;
};

export function parseProductFilterParams(
  searchParams: URLSearchParams,
): ParsedProductFilters {
  const brandParam = searchParams.get("brand") || "";
  const brands = brandParam
    .split(",")
    .map((b) => b.trim())
    .filter(Boolean);

  const sortRaw = (searchParams.get("sort") || "relevance") as ProductListSort;
  const allowed: ProductListSort[] = [
    "relevance",
    "price_asc",
    "price_desc",
    "name_asc",
  ];
  const sort = allowed.includes(sortRaw) ? sortRaw : "relevance";

  const inStockParam = searchParams.get("inStock");
  const inStockOnly =
    inStockParam === "true" || inStockParam === "1" || inStockParam === "yes";

  const priceMinRaw = searchParams.get("priceMin");
  const priceMaxRaw = searchParams.get("priceMax");
  const priceMin =
    priceMinRaw != null && priceMinRaw !== "" && !Number.isNaN(Number(priceMinRaw))
      ? Number(priceMinRaw)
      : null;
  const priceMax =
    priceMaxRaw != null && priceMaxRaw !== "" && !Number.isNaN(Number(priceMaxRaw))
      ? Number(priceMaxRaw)
      : null;

  return { brands, sort, inStockOnly, priceMin, priceMax };
}

/** Extra Mongo match clauses for catalog filters (beyond category / search). */
export function buildProductFilterMatch(
  filters: ParsedProductFilters,
): Filter<Document> {
  const match: Filter<Document> = {};

  if (filters.brands.length === 1) {
    match.brand = {
      $regex: `^${escapeRegex(filters.brands[0])}$`,
      $options: "i",
    };
  } else if (filters.brands.length > 1) {
    match.$or = filters.brands.map((brand) => ({
      brand: { $regex: `^${escapeRegex(brand)}$`, $options: "i" },
    }));
  }

  if (filters.inStockOnly) {
    match.isOutOfStock = { $ne: true };
  }

  if (filters.priceMin != null || filters.priceMax != null) {
    const price: Record<string, number> = {};
    if (filters.priceMin != null) price.$gte = filters.priceMin;
    if (filters.priceMax != null) price.$lte = filters.priceMax;
    match.discountedPrice = {
      ...(typeof match.discountedPrice === "object" &&
      match.discountedPrice !== null
        ? (match.discountedPrice as object)
        : {}),
      ...price,
    };
  }

  return match;
}

export function buildProductSort(sort: ProductListSort): Sort | null {
  switch (sort) {
    case "price_asc":
      return { discountedPrice: 1, name: 1 };
    case "price_desc":
      return { discountedPrice: -1, name: 1 };
    case "name_asc":
      return { name: 1 };
    default:
      return null;
  }
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
