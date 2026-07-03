import {
  getVertexPricingFromCache,
  setVertexPricingCache,
} from "./vertexPricingCache";
import { log, logError } from "../lib/logger";

export type VertexCategoryConfig = {
  l1Category: string;
  l2Category: string;
  l3Category: string;
};

type VertexVariantItem = {
  uid: number;
  slug?: string;
  value?: string;
  is_available?: boolean;
  medias?: { url?: string }[];
};

type VertexProductItem = {
  uid: number;
  name: string;
  slug?: string;
  sku_code?: string;
  item_code?: string;
  sellable?: boolean;
  seller_id?: number;
  brand?: { name?: string };
  country_of_origin?: string;
  medias?: { url?: string; type?: string; alt?: string }[];
  price?: {
    effective?: { min?: number; max?: number };
    marked?: { min?: number; max?: number };
  };
  attributes?: Record<string, string | string[]>;
  variants?: { items?: VertexVariantItem[]; key?: string }[];
  instock_variants?: {
    sizes?: string[];
    item_id?: string[];
    variantId?: string[];
  };
  sizes?: string[];
};

export type TransformedProduct = {
  name: string;
  image: string;
  discountedPrice: number;
  price: number;
  size: string;
  category: string;
  maxQuantity: number;
  isOutOfStock: boolean;
  isSmartBazaar: boolean;
  jiomartUid: string;
  jiomartSlug: string;
  skuCode: string;
  brand?: string;
  countryOfOrigin?: string;
  articleId?: string;
  foodType?: "veg" | "non-veg";
};

type VariantPrice = {
  discountedPrice: number;
  price: number;
};

const VERTEX_BASE_URL =
  "https://www.jiomart.com/ext/vertex/application/api/v1.0/products";

const DETAIL_CONCURRENCY = 5;

function buildFilter(config: VertexCategoryConfig, storeId: string): string {
  return [
    `l3_category:${config.l3Category}`,
    `department:groceries`,
    `l1_category:${config.l1Category}`,
    `l2_category:${config.l2Category}`,
    `journey:quickcommerce`,
    `store_ids:${storeId}`,
  ].join(":::");
}

function getVertexHeaders(): Record<string, string> {
  const auth = process.env.JIOMART_VERTEX_AUTH;
  if (!auth) {
    throw new Error("JIOMART_VERTEX_AUTH is not configured");
  }

  const locationDetail =
    process.env.JIOMART_LOCATION_DETAIL ||
    '{"country":"INDIA","country_iso_code":"IN","city":"HAPUR","pincode":"245304","state":"UTTAR PRADESH"}';

  const geolocation =
    process.env.JIOMART_GEOLOCATION ||
    '{"latitude":"28.709460487333036","longitude":"77.65183013239209","polygon_ids":["U3HM_QC_4978c36c"]}';

  return {
    Authorization: auth.startsWith("Bearer ") ? auth : `Bearer ${auth}`,
    "x-location-detail": locationDetail,
    "x-geolocation": geolocation,
    Accept: "application/json, text/plain, */*",
    "x-currency-code": "INR",
    "User-Agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36",
  };
}

function getStoreId(): string {
  return process.env.JIOMART_STORE_ID || "1979";
}

function slugToName(slug: string): string {
  const withoutUid = slug.replace(/-[a-z0-9]+-\d+$/i, "").replace(/-\d+$/, "");
  return withoutUid
    .split("-")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function buildVariantName(
  parentName: string,
  variant: VertexVariantItem,
  defaultSize: string,
): string {
  if (variant.slug) {
    return slugToName(variant.slug);
  }

  const size = variant.value || defaultSize;
  if (!size) return parentName;

  const normalizedDefault = defaultSize
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
  const normalizedSize = size.replace(/\s+/g, " ").trim().toLowerCase();

  if (normalizedDefault && normalizedDefault === normalizedSize) {
    return parentName;
  }

  const withoutSize = parentName
    .replace(/\s+\d+(\.\d+)?\s*(kg|g|l|ml|L|GM|KG|pcs?|os)\b.*$/i, "")
    .trim();

  return `${withoutSize} ${size}`.trim();
}
function deriveProductSize(
  item: VertexProductItem,
  variant: VertexVariantItem,
  defaultSize: string,
): string {
  const fromVariant = variant.value?.replace(/\s+/g, " ").trim();
  if (fromVariant) return fromVariant;

  const fromAttribute = defaultSize?.replace(/\s+/g, " ").trim();
  if (fromAttribute) return fromAttribute;

  const meaningfulInstockSize = item.instock_variants?.sizes?.find(
    (s) => s && s.toUpperCase() !== "OS",
  );
  if (meaningfulInstockSize) return meaningfulInstockSize;

  const meaningfulSize = item.sizes?.find((s) => s && s.toUpperCase() !== "OS");
  if (meaningfulSize) return meaningfulSize;

  const nameMatch = item.name.match(
    /(\d+(?:\.\d+)?)\s*(kg|g|l|ml|pack|pcs?)\b/i,
  );
  if (nameMatch) {
    return `${nameMatch[1]} ${nameMatch[2]}`.toLowerCase();
  }

  const slug = variant.slug || item.slug || "";
  const slugMatch = slug.match(/-(\d+(?:\.\d+)?)-(kg|g|l|ml)-/i);
  if (slugMatch) {
    return `${slugMatch[1]} ${slugMatch[2]}`.toLowerCase();
  }

  return "";
}

function extractPrice(item?: {
  price?: VertexProductItem["price"];
}): VariantPrice | null {
  const sellingPrice = item?.price?.effective?.min ?? 0;
  const mrp = item?.price?.marked?.min ?? 0;

  if (!sellingPrice || !mrp) return null;

  return {
    discountedPrice: Math.round(sellingPrice),
    price: Math.round(mrp),
  };
}

function parseFoodType(raw?: string): "veg" | "non-veg" | null {
  if (!raw) return null;
  if (raw === "green_dot") return "veg";
  if (raw === "red_dot" || raw === "brown_dot") return "non-veg";
  return null;
}

function extractArticleId(
  item: VertexProductItem,
  variantUid: number | string,
): string {
  const itemIds = item.instock_variants?.item_id;
  const variantIds = item.instock_variants?.variantId;
  if (itemIds?.length && variantIds?.length) {
    const index = itemIds.findIndex((id) => String(id) === String(variantUid));
    if (index >= 0 && variantIds[index]) {
      return String(variantIds[index]);
    }
  }
  return item.sku_code || item.item_code || "";
}

function isVariantInStockAtStore(
  item: VertexProductItem,
  variantUid: number | string,
): boolean {
  const instockIds = item.instock_variants?.item_id;
  if (!instockIds?.length) return true;
  return instockIds.some((id) => String(id) === String(variantUid));
}

function collectAvailableVariants(
  item: VertexProductItem,
): VertexVariantItem[] {
  const variants: VertexVariantItem[] = [];
  const seenUids = new Set<number>();

  for (const group of item.variants || []) {
    for (const variant of group.items || []) {
      if (!variant.is_available || !variant.uid) continue;
      if (!isVariantInStockAtStore(item, variant.uid)) continue;
      if (seenUids.has(variant.uid)) continue;
      seenUids.add(variant.uid);
      variants.push(variant);
    }
  }

  if (
    variants.length === 0 &&
    item.uid &&
    isVariantInStockAtStore(item, item.uid)
  ) {
    variants.push({
      uid: item.uid,
      slug: item.slug,
      value: (item.attributes?.["product-size"] as string | undefined) || "",
      is_available: true,
      medias: item.medias,
    });
  }

  return variants;
}

async function fetchVertexProductBySlug(
  slug: string,
  uid: string,
  vertexConfig?: VertexCategoryConfig,
): Promise<VariantPrice | null> {
  const storeId = getStoreId();
  const headers = getVertexHeaders();

  const detailUrls = [
    `${VERTEX_BASE_URL}/${slug}?store_ids=${storeId}`,
    `${VERTEX_BASE_URL}/product/${slug}?store_ids=${storeId}`,
    `${VERTEX_BASE_URL}?slug=${encodeURIComponent(slug)}&store_ids=${storeId}`,
  ];

  for (const url of detailUrls) {
    try {
      const response = await fetch(url, { method: "GET", headers });
      if (!response.ok) continue;

      const data = await response.json();
      const item =
        data?.data ||
        data?.product ||
        (data?.items?.[0] as VertexProductItem | undefined) ||
        (data?.uid ? (data as VertexProductItem) : null);

      if (item && String(item.uid) !== uid) {
        continue;
      }

      const price = extractPrice(item);
      if (price) return price;
    } catch {}
  }

  const searchFilter = vertexConfig
    ? buildFilter(vertexConfig, storeId)
    : buildQuickCommerceFilter(storeId);
  const params = new URLSearchParams({
    q: slug.replace(/-/g, " "),
    f: searchFilter,
    page_id: "*",
    page_size: "10",
    sort_on: "popular",
  });

  try {
    const response = await fetch(`${VERTEX_BASE_URL}?${params.toString()}`, {
      method: "GET",
      headers,
    });

    if (response.ok) {
      const data = await response.json();
      const match = (data.items || []).find(
        (entry: VertexProductItem) =>
          String(entry.uid) === uid && (entry.slug === slug || !entry.slug),
      );
      const price = extractPrice(match);
      if (price) return price;
    }
  } catch {}

  return null;
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  mapper: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  let index = 0;

  async function worker() {
    while (index < items.length) {
      const currentIndex = index++;
      results[currentIndex] = await mapper(items[currentIndex]);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => worker()),
  );

  return results;
}

export type VertexPricingResult = {
  price?: number;
  discountedPrice?: number;
  maxQuantity: number;
  isOutOfStock: boolean;
  matched: boolean;
};

function logLatestJiomartPrice(
  product: { name: string; jiomartUid?: string },
  pricing: VertexPricingResult | null,
  source: "redis" | "jiomart-api" | "slug-detail",
) {
  log("[jiomart] latest price", {
    source,
    jiomartUid: product.jiomartUid ?? null,
    name: product.name,
    mrp: pricing?.price ?? null,
    sellingPrice: pricing?.discountedPrice ?? null,
    maxQuantity: pricing?.maxQuantity ?? null,
    isOutOfStock: pricing?.isOutOfStock ?? null,
    hasPrice: Boolean(pricing?.price && pricing?.discountedPrice),
  });
}

function buildQuickCommerceFilter(storeId: string): string {
  return `journey:quickcommerce:::store_ids:${storeId}`;
}

function normalizeProductName(name: string): string {
  return name.toLowerCase().replace(/\s+/g, " ").trim();
}

function findMatchingVariantInSearchResults(
  items: VertexProductItem[],
  target: { name: string; jiomartUid?: string; jiomartSlug?: string },
): { item: VertexProductItem; variant: VertexVariantItem } | null {
  for (const item of items) {
    for (const variant of collectAvailableVariants(item)) {
      if (target.jiomartUid && String(variant.uid) === target.jiomartUid) {
        return { item, variant };
      }
      if (target.jiomartSlug && variant.slug === target.jiomartSlug) {
        return { item, variant };
      }
    }
  }

  const normalizedTarget = normalizeProductName(target.name);
  for (const item of items) {
    const defaultSize =
      (item.attributes?.["product-size"] as string | undefined) || "";
    for (const variant of collectAvailableVariants(item)) {
      const variantName = buildVariantName(item.name, variant, defaultSize);
      if (normalizeProductName(variantName) === normalizedTarget) {
        return { item, variant };
      }
    }
  }

  return null;
}

export async function searchVertexProductsByQuery(
  query: string,
  pageSize = 40,
): Promise<VertexProductItem[]> {
  const startedAt = Date.now();
  const storeId = getStoreId();
  const params = new URLSearchParams({
    f: buildQuickCommerceFilter(storeId),
    page_id: "*",
    page_size: String(pageSize),
    q: query,
  });

  const url = `${VERTEX_BASE_URL}?${params.toString()}`;
  log("[jiomart] API call →", { query, pageSize, storeId });

  const response = await fetch(url, {
    method: "GET",
    headers: getVertexHeaders(),
  });

  if (!response.ok) {
    const body = await response.text();
    logError("[jiomart] API call FAILED", {
      query,
      status: response.status,
      durationMs: Date.now() - startedAt,
      body: body.slice(0, 200),
    });
    return [];
  }

  const data = await response.json();
  const items = (data.items || []) as VertexProductItem[];
  log("[jiomart] API call ✓", {
    query,
    resultCount: items.length,
    durationMs: Date.now() - startedAt,
  });
  return items;
}

const SEARCH_DELAY_MS = 250;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function deriveVertexSearchQuery(product: {
  name: string;
  jiomartSlug?: string;
}): string {
  const trimmedName = product.name.trim();
  if (trimmedName) return trimmedName;

  if (product.jiomartSlug) {
    return slugToName(product.jiomartSlug);
  }

  return trimmedName;
}

class VertexSearchCache {
  private cache = new Map<string, VertexProductItem[]>();
  private inflight = new Map<string, Promise<VertexProductItem[]>>();
  jiomartApiCalls = 0;
  inMemoryHits = 0;

  private key(query: string) {
    return query.toLowerCase().trim();
  }

  async get(query: string): Promise<VertexProductItem[]> {
    const key = this.key(query);
    const cached = this.cache.get(key);
    if (cached) {
      this.inMemoryHits++;
      log("[jiomart] in-memory search cache hit (no API call)", {
        query,
      });
      return cached;
    }

    const pending = this.inflight.get(key);
    if (pending) {
      log("[jiomart] in-flight search deduped (no extra API call)", {
        query,
      });
      return pending;
    }

    this.jiomartApiCalls++;
    const promise = searchVertexProductsByQuery(query).then((items) => {
      this.cache.set(key, items);
      this.inflight.delete(key);
      return items;
    });
    this.inflight.set(key, promise);
    return promise;
  }

  async prefetchAll(queries: string[]) {
    const unique = Array.from(
      new Set(queries.map((q) => q.trim()).filter(Boolean)),
    );

    for (let i = 0; i < unique.length; i++) {
      if (i > 0) {
        await sleep(SEARCH_DELAY_MS);
      }
      await this.get(unique[i]);
    }
  }

  get size() {
    return this.cache.size;
  }
}

function resolveVertexPricingFromItems(
  items: VertexProductItem[],
  productName: string,
  options?: { jiomartUid?: string; jiomartSlug?: string },
): VertexPricingResult | null {
  if (items.length === 0) return null;

  const match = findMatchingVariantInSearchResults(items, {
    name: productName,
    jiomartUid: options?.jiomartUid,
    jiomartSlug: options?.jiomartSlug,
  });

  if (!match) return null;

  const { item, variant } = match;
  const maxQuantity =
    parseInt(
      (item.attributes?.["max-qty-in-order"] as string | undefined) || "1",
      10,
    ) || 1;

  const isDefaultVariant = String(variant.uid) === String(item.uid);
  const listingPrice = extractPrice(item);

  if (isDefaultVariant && listingPrice) {
    return {
      price: listingPrice.price,
      discountedPrice: listingPrice.discountedPrice,
      maxQuantity,
      isOutOfStock: false,
      matched: true,
    };
  }

  const topLevelVariantItem = items.find(
    (candidate) => String(candidate.uid) === String(variant.uid),
  );
  const variantListingPrice = topLevelVariantItem
    ? extractPrice(topLevelVariantItem)
    : null;
  if (variantListingPrice) {
    return {
      price: variantListingPrice.price,
      discountedPrice: variantListingPrice.discountedPrice,
      maxQuantity,
      isOutOfStock: false,
      matched: true,
    };
  }

  return {
    maxQuantity,
    isOutOfStock: false,
    matched: true,
  };
}

export async function fetchVertexProductPricingBatch(
  products: Array<{
    name: string;
    jiomartUid?: string;
    jiomartSlug?: string;
  }>,
): Promise<(VertexPricingResult | null)[]> {
  if (products.length === 0) return [];

  const results: (VertexPricingResult | null)[] = new Array(products.length);
  const uncachedIndices: number[] = [];
  let cacheHits = 0;

  for (let i = 0; i < products.length; i++) {
    const uid = products[i].jiomartUid;
    if (uid) {
      const cached = await getVertexPricingFromCache(uid);
      if (cached) {
        results[i] = cached;
        cacheHits++;
        logLatestJiomartPrice(products[i], cached, "redis");
        continue;
      }
      log("[jiomart] Redis pricing cache miss", {
        jiomartUid: uid,
        name: products[i].name,
      });
    } else {
      log("[jiomart] no jiomartUid — will call JioMart API", {
        name: products[i].name,
      });
    }
    uncachedIndices.push(i);
  }

  if (uncachedIndices.length === 0) {
    log("[jiomart] batch complete — NO JioMart API calls", {
      products: products.length,
      redisCacheHits: cacheHits,
      jiomartApiCalls: 0,
    });
    return results;
  }

  const searchCache = new VertexSearchCache();
  const uncachedProducts = uncachedIndices.map((i) => products[i]);
  const primaryQueries = uncachedProducts.map((p) =>
    deriveVertexSearchQuery(p),
  );

  await searchCache.prefetchAll(primaryQueries);

  for (let j = 0; j < uncachedIndices.length; j++) {
    const i = uncachedIndices[j];
    const product = products[i];
    const primaryItems = await searchCache.get(primaryQueries[j]);
    let pricing = resolveVertexPricingFromItems(primaryItems, product.name, {
      jiomartUid: product.jiomartUid,
      jiomartSlug: product.jiomartSlug,
    });

    let priceSource: "jiomart-api" | "slug-detail" = "jiomart-api";

    const needsPrice =
      pricing?.matched && !pricing.price && product.jiomartSlug;
    if (needsPrice) {
      const fallbackQuery = slugToName(product.jiomartSlug!);
      const fallbackItems = await searchCache.get(fallbackQuery);
      const fallbackPricing = resolveVertexPricingFromItems(
        fallbackItems,
        product.name,
        {
          jiomartUid: product.jiomartUid,
          jiomartSlug: product.jiomartSlug,
        },
      );

      if (fallbackPricing?.price) {
        pricing = { ...pricing, ...fallbackPricing };
      }

      if (!pricing?.price && product.jiomartUid) {
        log("[jiomart] slug detail fetch for variant price", {
          jiomartUid: product.jiomartUid,
          slug: product.jiomartSlug,
        });
        const detailPrice = await fetchVertexProductBySlug(
          product.jiomartSlug!,
          product.jiomartUid,
        );
        if (detailPrice) {
          pricing = {
            ...pricing!,
            price: detailPrice.price,
            discountedPrice: detailPrice.discountedPrice,
          };
          priceSource = "slug-detail";
          log("[jiomart] slug detail fetch ✓", {
            jiomartUid: product.jiomartUid,
            mrp: detailPrice.price,
            sellingPrice: detailPrice.discountedPrice,
          });
        }
      }
    }

    results[i] = pricing;
    logLatestJiomartPrice(product, pricing, priceSource);

    if (product.jiomartUid && pricing) {
      await setVertexPricingCache(product.jiomartUid, pricing);
    }
  }

  log("[jiomart] batch complete", {
    products: products.length,
    jiomartApiCalls: searchCache.jiomartApiCalls,
    inMemorySearchHits: searchCache.inMemoryHits,
    uniqueSearchQueries: searchCache.size,
    redisCacheHits: cacheHits,
    uncachedProducts: uncachedIndices.length,
  });

  return results;
}

export async function fetchVertexProductPricing(
  productName: string,
  options?: { jiomartUid?: string; jiomartSlug?: string },
): Promise<VertexPricingResult | null> {
  const [result] = await fetchVertexProductPricingBatch([
    { name: productName, ...options },
  ]);
  return result;
}

export async function transformVertexProducts(
  items: VertexProductItem[],
  categoryName: string,
  vertexConfig: VertexCategoryConfig,
): Promise<TransformedProduct[]> {
  type PendingVariant = {
    item: VertexProductItem;
    variant: VertexVariantItem;
    defaultSize: string;
    maxQuantity: number;
    isSmartBazaar: boolean;
    skuCode: string;
    parentPrice: VariantPrice;
  };

  const pending: PendingVariant[] = [];

  for (const item of items) {
    if (!item.sellable) continue;

    const parentPrice = extractPrice(item);
    if (!parentPrice) continue;

    const defaultSize =
      (item.attributes?.["product-size"] as string | undefined) || "";
    const maxQuantity = parseInt(
      (item.attributes?.["max-qty-in-order"] as string | undefined) || "1",
      10,
    );
    const sellerType = item.attributes?.["seller-type"];
    const isSmartBazaar = sellerType === "1p" && item.seller_id === 1;

    for (const variant of collectAvailableVariants(item)) {
      pending.push({
        item,
        variant,
        defaultSize,
        maxQuantity: maxQuantity || 1,
        isSmartBazaar,
        skuCode: item.sku_code || "",
        parentPrice,
      });
    }
  }

  const pricedVariants = await mapWithConcurrency(
    pending,
    DETAIL_CONCURRENCY,
    async (entry) => {
      const { item, variant, parentPrice } = entry;
      let price = parentPrice;

      if (String(variant.uid) !== String(item.uid) && variant.slug) {
        const detailPrice = await fetchVertexProductBySlug(
          variant.slug,
          String(variant.uid),
          vertexConfig,
        );

        if (detailPrice) {
          price = detailPrice;
        } else {
          return null;
        }
      }

      const image = variant.medias?.[0]?.url || item.medias?.[0]?.url || "";
      const size = deriveProductSize(item, variant, entry.defaultSize);
      const name = buildVariantName(item.name, variant, entry.defaultSize);
      const foodType = parseFoodType(
        item.attributes?.["food-type"] as string | undefined,
      );

      return {
        name,
        image,
        discountedPrice: price.discountedPrice,
        price: price.price,
        size,
        category: categoryName,
        maxQuantity: entry.maxQuantity,
        isOutOfStock: false,
        isSmartBazaar: entry.isSmartBazaar,
        jiomartUid: String(variant.uid),
        jiomartSlug: variant.slug || item.slug || "",
        skuCode: entry.skuCode,
        brand: item.brand?.name,
        countryOfOrigin: item.country_of_origin,
        articleId: extractArticleId(item, variant.uid),
        foodType: foodType ?? undefined,
      } satisfies TransformedProduct;
    },
  );

  const seenUids = new Set<string>();
  const products: TransformedProduct[] = [];
  for (const product of pricedVariants) {
    if (!product || seenUids.has(product.jiomartUid)) continue;
    seenUids.add(product.jiomartUid);
    products.push(product);
  }
  return products;
}

export async function fetchVertexProducts(
  config: VertexCategoryConfig,
  pageSize = 50,
): Promise<VertexProductItem[]> {
  const storeId = getStoreId();
  const filter = buildFilter(config, storeId);
  const headers = getVertexHeaders();
  const allItems: VertexProductItem[] = [];

  let pageId = "*";

  while (true) {
    const params = new URLSearchParams({
      f: filter,
      page_id: pageId,
      page_size: String(pageSize),
      sort_on: "popular",
    });

    const response = await fetch(`${VERTEX_BASE_URL}?${params.toString()}`, {
      method: "GET",
      headers,
    });

    if (!response.ok) {
      throw new Error(
        `JioMart Vertex API failed (${response.status}): ${await response.text()}`,
      );
    }

    const data = await response.json();
    const items = (data.items || []) as VertexProductItem[];
    allItems.push(...items);

    const page = data.page;
    if (!page?.has_next || !page?.next_id) break;
    pageId = page.next_id;
  }

  return allItems;
}
