import assert from "node:assert/strict";
import {
  buildProductFilterMatch,
  buildProductSort,
  parseProductFilterParams,
} from "../productListFilters";

// parseProductFilterParams
{
  const empty = parseProductFilterParams(new URLSearchParams());
  assert.deepEqual(empty, {
    brands: [],
    sort: "relevance",
    inStockOnly: false,
    priceMin: null,
    priceMax: null,
  });

  const full = parseProductFilterParams(
    new URLSearchParams({
      brand: "Tata, Amul ,",
      sort: "price_asc",
      inStock: "true",
      priceMin: "10",
      priceMax: "99",
    }),
  );
  assert.deepEqual(full.brands, ["Tata", "Amul"]);
  assert.equal(full.sort, "price_asc");
  assert.equal(full.inStockOnly, true);
  assert.equal(full.priceMin, 10);
  assert.equal(full.priceMax, 99);

  const stockVariants = ["1", "yes", "true"].map((inStock) =>
    parseProductFilterParams(new URLSearchParams({ inStock })),
  );
  assert.ok(stockVariants.every((f) => f.inStockOnly === true));

  const badSort = parseProductFilterParams(
    new URLSearchParams({ sort: "not_a_sort" }),
  );
  assert.equal(badSort.sort, "relevance");

  const badPrice = parseProductFilterParams(
    new URLSearchParams({ priceMin: "nope", priceMax: "" }),
  );
  assert.equal(badPrice.priceMin, null);
  assert.equal(badPrice.priceMax, null);
}

// buildProductFilterMatch
{
  const none = buildProductFilterMatch({
    brands: [],
    sort: "relevance",
    inStockOnly: false,
    priceMin: null,
    priceMax: null,
  });
  assert.deepEqual(none, {});

  const oneBrand = buildProductFilterMatch({
    brands: ["Good Life"],
    sort: "relevance",
    inStockOnly: false,
    priceMin: null,
    priceMax: null,
  });
  assert.ok(oneBrand.brand);
  assert.equal((oneBrand.brand as { $options: string }).$options, "i");

  const multi = buildProductFilterMatch({
    brands: ["A", "B"],
    sort: "relevance",
    inStockOnly: true,
    priceMin: 20,
    priceMax: 100,
  });
  assert.ok(Array.isArray(multi.$or));
  assert.equal((multi.$or as unknown[]).length, 2);
  assert.deepEqual(multi.isOutOfStock, { $ne: true });
  assert.deepEqual(multi.discountedPrice, { $gte: 20, $lte: 100 });

  const minOnly = buildProductFilterMatch({
    brands: [],
    sort: "relevance",
    inStockOnly: false,
    priceMin: 5,
    priceMax: null,
  });
  assert.deepEqual(minOnly.discountedPrice, { $gte: 5 });

  const regexSafe = buildProductFilterMatch({
    brands: ["A+B (special)"],
    sort: "relevance",
    inStockOnly: false,
    priceMin: null,
    priceMax: null,
  });
  const pattern = String(
    (regexSafe.brand as { $regex: string }).$regex,
  );
  assert.ok(pattern.includes("\\+"));
  assert.ok(pattern.includes("\\("));
}

// buildProductSort
{
  assert.equal(buildProductSort("relevance"), null);
  assert.deepEqual(buildProductSort("price_asc"), {
    discountedPrice: 1,
    name: 1,
  });
  assert.deepEqual(buildProductSort("price_desc"), {
    discountedPrice: -1,
    name: 1,
  });
  assert.deepEqual(buildProductSort("name_asc"), { name: 1 });
}

console.log("productListFilters tests passed");
