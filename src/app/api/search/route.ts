import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "../lib/dbconnection";
import { log, logError } from "../lib/logger";

export async function GET(req: NextRequest) {
  const startedAt = Date.now();

  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get("query") || "";
    const searchType = searchParams.get("type") || "autocomplete";
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "10", 10);

    log("[search] request", { query, searchType, page, limit });

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

    if (searchType === "autocomplete") {
      const skip = (page - 1) * limit;

      const totalAgg = [
        {
          $search: {
            index: "autocomplete-index",
            autocomplete: { query: query, path: "name" },
          },
        },
        {
          $match: { discountedPrice: { $gt: 0 } },
        },
        {
          $count: "totalResults",
        },
      ];

      const totalResultsObj = await db
        .collection("products")
        .aggregate(totalAgg)
        .toArray();

      const totalResults =
        totalResultsObj.length > 0 ? totalResultsObj[0].totalResults : 0;
      const totalPages = Math.ceil(totalResults / limit);

      const agg = [
        {
          $search: {
            index: "autocomplete-index",
            autocomplete: { query: query, path: "name" },
          },
        },
        {
          $match: { discountedPrice: { $gt: 0 } },
        },
        { $skip: skip },
        { $limit: limit },
      ];

      const results = await db.collection("products").aggregate(agg).toArray();

      log("[search] autocomplete results", {
        query,
        totalResults,
        returnedCount: results.length,
        durationMs: Date.now() - startedAt,
      });

      return NextResponse.json(
        { results, totalResults, totalPages, currentPage: page },
        { status: 200 },
      );
    }

    if (searchType === "search") {
      const skip = (page - 1) * limit;

      const results = await db
        .collection("products")
        .find({ $text: { $search: query } })
        .limit(limit)
        .skip(skip)
        .toArray();

      const totalResults = await db
        .collection("products")
        .countDocuments({ $text: { $search: query } });

      const totalPages = Math.ceil(totalResults / limit);

      log("[search] full-text results", {
        query,
        totalResults,
        returnedCount: results.length,
        durationMs: Date.now() - startedAt,
      });

      return NextResponse.json(
        { results, totalResults, totalPages, currentPage: page },
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
