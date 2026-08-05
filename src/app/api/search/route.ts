import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "../lib/dbconnection";
import { log, logError } from "../lib/logger";
import { isTokenVerified } from "@/json";
import { expandSearchQueries } from "./grocerySynonyms";
import {
  buildProductFilterMatch,
  buildProductSort,
  parseProductFilterParams,
} from "../products/productListFilters";

const AUTOCOMPLETE_SEARCH_INDEX = "autocomplete-index";

const AUTOCOMPLETE_FUZZY = {
  maxEdits: 1,
  prefixLength: 2,
  maxExpansions: 50,
} as const;

function buildAutocompleteClause(query: string) {
  return {
    autocomplete: {
      query,
      path: "name",
      fuzzy: AUTOCOMPLETE_FUZZY,
    },
  };
}

/**
 * Single-term autocomplete, or compound.should across synonym variants.
 * Atlas autocomplete does not apply synonym mappings, so we expand in app code.
 */
function buildAutocompleteSearch(queries: string[]) {
  const unique = Array.from(
    new Set(queries.map((q) => q.trim()).filter(Boolean)),
  );
  if (unique.length <= 1) {
    return {
      index: AUTOCOMPLETE_SEARCH_INDEX,
      ...buildAutocompleteClause(unique[0] || ""),
    };
  }

  return {
    index: AUTOCOMPLETE_SEARCH_INDEX,
    compound: {
      should: unique.map(buildAutocompleteClause),
      minimumShouldMatch: 1,
    },
  };
}

function expandTextSearchQuery(query: string): string {
  const variants = expandSearchQueries(query);
  return variants.join(" ");
}

function buildSearchMatchStage(filters: ReturnType<typeof parseProductFilterParams>) {
  const filterMatch = buildProductFilterMatch(filters);
  const priceClause: Record<string, unknown> = { $gt: 0 };
  if (filters.priceMin != null) priceClause.$gte = filters.priceMin;
  if (filters.priceMax != null) priceClause.$lte = filters.priceMax;

  const match: Record<string, unknown> = {
    discountedPrice: priceClause,
    promoOnly: { $ne: true },
  };

  if (filterMatch.brand) match.brand = filterMatch.brand;
  if (filterMatch.$or) match.$or = filterMatch.$or;
  if (filterMatch.isOutOfStock) match.isOutOfStock = filterMatch.isOutOfStock;

  return match;
}

export async function GET(req: NextRequest) {
  const startedAt = Date.now();

  try {
    const tokenVerificationResponse = await isTokenVerified(req);
    if (tokenVerificationResponse) {
      return tokenVerificationResponse;
    }
    const { searchParams } = new URL(req.url);
    const query = searchParams.get("query") || "";
    const searchType = searchParams.get("type") || "autocomplete";
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "10", 10);
    const filters = parseProductFilterParams(searchParams);

    const queryVariants = expandSearchQueries(query);

    log("[search] request", {
      query,
      queryVariants,
      searchType,
      page,
      limit,
      filters,
    });

    if (!query) {
      return NextResponse.json(
        { message: "Missing search query" },
        { status: 400 },
      );
    }

    const db = await connectDB(req);

    if (!db) {
      logError("[search] db connection failed");
      return NextResponse.json(
        { error: "Database connection failed" },
        { status: 500 },
      );
    }

    const matchStage = buildSearchMatchStage(filters);
    const sort = buildProductSort(filters.sort);

    if (searchType === "autocomplete") {
      const skip = (page - 1) * limit;
      const autocompleteSearch = buildAutocompleteSearch(queryVariants);

      const totalAgg = [
        { $search: autocompleteSearch },
        { $match: matchStage },
        { $count: "totalResults" },
      ];

      const totalResultsObj = await db
        .collection("products")
        .aggregate(totalAgg)
        .toArray();

      const totalResults =
        totalResultsObj.length > 0 ? totalResultsObj[0].totalResults : 0;
      const totalPages = Math.ceil(totalResults / limit);

      const agg: Record<string, unknown>[] = [
        { $search: autocompleteSearch },
        { $match: matchStage },
      ];
      if (sort) {
        agg.push({ $sort: sort });
      }
      agg.push({ $skip: skip }, { $limit: limit });

      const results = await db.collection("products").aggregate(agg).toArray();

      log("[search] autocomplete results", {
        query,
        queryVariants,
        totalResults,
        returnedCount: results.length,
        durationMs: Date.now() - startedAt,
      });

      return NextResponse.json(
        {
          results,
          totalResults,
          totalPages,
          currentPage: page,
          queryVariants,
        },
        { status: 200 },
      );
    }

    if (searchType === "search") {
      const skip = (page - 1) * limit;
      const textQuery = expandTextSearchQuery(query);

      const findQuery = {
        $text: { $search: textQuery },
        ...matchStage,
      };

      let cursor = db.collection("products").find(findQuery);
      if (sort) {
        cursor = cursor.sort(sort);
      }

      const results = await cursor.limit(limit).skip(skip).toArray();

      const totalResults = await db
        .collection("products")
        .countDocuments(findQuery);

      const totalPages = Math.ceil(totalResults / limit);

      log("[search] full-text results", {
        query,
        textQuery,
        totalResults,
        returnedCount: results.length,
        durationMs: Date.now() - startedAt,
      });

      return NextResponse.json(
        {
          results,
          totalResults,
          totalPages,
          currentPage: page,
          queryVariants,
        },
        { status: 200 },
      );
    }

    return NextResponse.json(
      { message: "Invalid search type" },
      { status: 400 },
    );
  } catch (error) {
    logError("[search] error", {
      message: error instanceof Error ? error.message : String(error),
      durationMs: Date.now() - startedAt,
    });

    return NextResponse.json(
      {
        error: "Something went wrong",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
