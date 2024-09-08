import { isTokenVerified } from "@/json";
import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";
import { connectDB } from "../lib/dbconnection";

export async function GET(req, res) {
  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get("query") || "";
    const searchType = searchParams.get("type") || "autocomplete"; // "autocomplete" or "search"
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "10", 10);

    if (!query) {
      return NextResponse.json(
        { message: "Missing search query" },
        { status: 400 }
      );
    }

    const db = await connectDB(req);
    let results;

    if (searchType === "autocomplete") {
      // // Remove duplicates by ensuring each product ID is unique

      const skip = (page - 1) * limit;
      console.log("uytrddfghjk", skip, page);
      const totalAgg = [
        {
          $search: {
            index: "autocomplete-index",
            autocomplete: { query: query, path: "name" },
          },
        },
        {
          $count: "totalResults",
        },
      ];

      // Fetch total number of matching documents
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
        { $skip: skip },
        { $limit: limit },
      ];

      results = await db.collection("products").aggregate(agg).toArray();
      return NextResponse.json(
        { results, totalResults, totalPages, currentPage: page },
        { status: 200 }
      );
      console.log("8765edfghj", results);
    } else if (searchType === "search") {
      // Full-Text Search: Perform a full-text search on the products
      const skip = (page - 1) * limit;
      results = await db
        .collection("products")
        .find({ $text: { $search: query } })
        .limit(limit)
        .skip(skip)
        .toArray();

      // Get the total count for pagination
      const totalResults = await db
        .collection("products")
        .countDocuments({ $text: { $search: query } });

      const totalPages = Math.ceil(totalResults / limit);

      return NextResponse.json(
        { results, totalResults, totalPages, currentPage: page },
        { status: 200 }
      );
    } else {
      return NextResponse.json(
        { message: "Invalid search type" },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
