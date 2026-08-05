import { isTokenVerified } from "@/json";
import { ObjectId } from "mongodb";
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "../../lib/dbconnection";
import { logError } from "../../lib/logger";
import { expandSearchQueries } from "../../search/grocerySynonyms";

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

/**
 * GET /api/products/brands?categoryId=…  — brands in a subcategory
 * GET /api/products/brands?query=…       — brands among search matches
 */
export async function GET(req: NextRequest) {
  try {
    const tokenVerificationResponse = await isTokenVerified(req);
    if (tokenVerificationResponse) {
      return tokenVerificationResponse;
    }

    const { searchParams } = new URL(req.url);
    const categoryId = searchParams.get("categoryId");
    const query = searchParams.get("query") || "";

    if (!categoryId && !query) {
      return NextResponse.json(
        { message: "Provide categoryId or query" },
        { status: 400 },
      );
    }

    const db = await connectDB(req);
    if (!db) {
      return NextResponse.json(
        { error: "Database connection failed" },
        { status: 500 },
      );
    }

    const baseMatch = {
      discountedPrice: { $gt: 0 },
      promoOnly: { $ne: true },
      brand: { $exists: true, $nin: [null, ""] },
    };

    let brands: string[] = [];

    if (categoryId) {
      brands = (await db.collection("products").distinct("brand", {
        ...baseMatch,
        categoryPath: new ObjectId(categoryId),
      })) as string[];
    } else {
      const queryVariants = expandSearchQueries(query);
      const autocompleteSearch = buildAutocompleteSearch(queryVariants);
      const agg = [
        { $search: autocompleteSearch },
        { $match: baseMatch },
        {
          $group: {
            _id: { $toLower: "$brand" },
            brand: { $first: "$brand" },
          },
        },
        { $sort: { brand: 1 } },
        { $limit: 100 },
      ];
      const rows = await db.collection("products").aggregate(agg).toArray();
      brands = rows.map((r) => String(r.brand)).filter(Boolean);
    }

    const normalized = Array.from(
      new Set(
        brands
          .map((b) => (typeof b === "string" ? b.trim() : ""))
          .filter(Boolean),
      ),
    ).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));

    return NextResponse.json({ brands: normalized }, { status: 200 });
  } catch (error) {
    logError("Error:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 },
    );
  }
}
