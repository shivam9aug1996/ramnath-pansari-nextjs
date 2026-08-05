import { isTokenVerified } from "@/json";
import { ObjectId } from "mongodb";
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "../lib/dbconnection";

import categoryConfig from "./categoryConfig";
import { syncJiomartCategories } from "./jiomartSync";
import { logError } from "../lib/logger";
import {
  buildProductFilterMatch,
  buildProductSort,
  parseProductFilterParams,
} from "./productListFilters";

export async function POST(req: NextRequest) {
  if (req.method !== "POST") {
    return NextResponse.json(
      { message: "Method not allowed" },
      { status: 405 },
    );
  }

  try {
    const { name, categoryPath, image, discountedPrice, price, size } =
      await req.json();

    if (
      !name ||
      !categoryPath ||
      !Array.isArray(categoryPath) ||
      categoryPath.length === 0 ||
      !discountedPrice ||
      !price ||
      !size
    ) {
      return NextResponse.json(
        { message: "Missing required fields" },
        { status: 400 },
      );
    }

    const tokenVerificationResponse = await isTokenVerified(req);
    if (tokenVerificationResponse) {
      return tokenVerificationResponse;
    }

    const db = await connectDB(req);

    const newProduct = {
      _id: new ObjectId(),
      name,
      categoryPath: categoryPath.map((id) => new ObjectId(id)),
      image: image || null,
      discountedPrice,
      price,
      size,
    };

    const result = await db.collection("products").insertOne(newProduct);

    if (!result.acknowledged) {
      return NextResponse.json(
        { message: "Product creation failed" },
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        message: "Product created successfully",
        productData: newProduct,
      },
      { status: 201 },
    );
  } catch (error) {
    logError("Error:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 },
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const categoryId = searchParams.get("categoryId");
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "10", 10);
    const filters = parseProductFilterParams(searchParams);

    if (!categoryId) {
      return NextResponse.json(
        { message: "Missing category ID" },
        { status: 400 },
      );
    }

    const tokenVerificationResponse = await isTokenVerified(req);
    if (tokenVerificationResponse) {
      return tokenVerificationResponse;
    }

    const db = await connectDB(req);

    const skip = (page - 1) * limit;
    const filterMatch = buildProductFilterMatch(filters);

    const priceClause: Record<string, unknown> = { $ne: 0 };
    if (filters.priceMin != null) priceClause.$gte = filters.priceMin;
    if (filters.priceMax != null) priceClause.$lte = filters.priceMax;

    const query: Record<string, unknown> = {
      categoryPath: new ObjectId(categoryId),
      promoOnly: { $ne: true },
      discountedPrice: priceClause,
    };

    if (filterMatch.brand) query.brand = filterMatch.brand;
    if (filterMatch.$or) query.$or = filterMatch.$or;
    if (filterMatch.isOutOfStock) query.isOutOfStock = filterMatch.isOutOfStock;

    const sort = buildProductSort(filters.sort);
    let cursor = db.collection("products").find(query);
    if (sort) {
      cursor = cursor.sort(sort);
    }

    const products = await cursor.skip(skip).limit(limit).toArray();

    const totalProducts = await db.collection("products").countDocuments(query);

    const totalPages = Math.ceil(totalProducts / limit);

    const responseData = {
      products,
      totalProducts,
      totalResults: totalProducts,
      totalPages,
      currentPage: page,
      categoryId,
    };

    return NextResponse.json(responseData, { status: 200 });
  } catch (error) {
    logError("Error:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 },
    );
  }
}

const getRandomPrice = (min: number, max: number) => {
  return parseFloat((Math.random() * (max - min) + min).toFixed(2));
};

export async function PUT(req: NextRequest) {
  if (req.method !== "PUT") {
    return NextResponse.json(
      { message: "Method not allowed" },
      { status: 405 },
    );
  }

  try {
    const tokenVerificationResponse = await isTokenVerified(req);
    if (tokenVerificationResponse) {
      return tokenVerificationResponse;
    }

    const db = await connectDB(req);

    const priceMin = 10;
    const priceMax = 1000;
    const discountedPriceMin = 5;
    const discountedPriceMax = 500;

    const result = await db.collection("products").updateMany(
      {},
      {
        $set: {
          price: getRandomPrice(priceMin, priceMax),
          discountedPrice: getRandomPrice(
            discountedPriceMin,
            discountedPriceMax,
          ),
        },
      },
    );

    if (result.modifiedCount === 0) {
      return NextResponse.json(
        { message: "No products were updated" },
        { status: 404 },
      );
    }

    return NextResponse.json(
      {
        message: "Products updated successfully",
        modifiedCount: result.modifiedCount,
      },
      { status: 200 },
    );
  } catch (error) {
    logError("Error:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 },
    );
  }
}

export async function PATCH(req: NextRequest) {
  if (req.method !== "PATCH") {
    return NextResponse.json(
      { message: "Method not allowed" },
      { status: 405 },
    );
  }

  try {
    const { categories, wipeAll = false, syncAll = false } = await req.json();
    const db = await connectDB(req);

    const categoryList = syncAll
      ? Object.keys(categoryConfig)
      : categories;

    if (!Array.isArray(categoryList) || categoryList.length === 0) {
      return NextResponse.json(
        { message: "Provide categories array or syncAll: true" },
        { status: 400 },
      );
    }

    const result = await syncJiomartCategories(db, {
      categories: categoryList,
      wipeAll,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    logError("Error:", error);
    return NextResponse.json(
      {
        error: "Something went wrong",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
