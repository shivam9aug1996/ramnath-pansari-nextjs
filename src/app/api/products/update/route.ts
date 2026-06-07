import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "../../lib/dbconnection";
import { syncProductPrices } from "../syncProductPrices";

export async function PATCH(req: NextRequest) {
  if (req.method !== "PATCH") {
    return NextResponse.json(
      { message: "Method not allowed" },
      { status: 405 },
    );
  }

  try {
    const { products } = await req.json();

    if (!products || !Array.isArray(products) || products.length === 0) {
      return NextResponse.json(
        { error: "Products array is required" },
        { status: 400 },
      );
    }

    const db = await connectDB(req);
    const results = await syncProductPrices(db, products);

    return NextResponse.json(
      {
        message: "Products sync completed",
        results,
        summary: {
          totalRequested: products.length,
          totalProcessed: results.length,
          updated: results.filter((r) => r.status === "updated").length,
          notFound: results.filter((r) => r.status === "not_found_in_jioMart")
            .length,
          errors: results.filter((r) => r.status === "error").length,
        },
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json(
      {
        error: "Something went wrong",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
