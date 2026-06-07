import { isTokenVerified } from "@/json";
import { ObjectId } from "mongodb";
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "../lib/dbconnection";

import categoryConfig from "./categoryConfig";
import { fetchVertexProducts, transformVertexProducts } from "./jiomartVertex";
import RedisClient from "../lib/redisClient";
import { log, logError } from "../lib/logger";

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

    const cacheKey = `products:${categoryId}:page:${page}:limit:${limit}`;
    log("products cache key", cacheKey);

    let redis = null;
    try {
      redis = await RedisClient.getInstance();
    } catch (error) {
      logError("redis get error", error);
    }

    const cachedData = await redis?.get(cacheKey);

    if (cachedData) {
      let data = JSON.parse(cachedData);

      return NextResponse.json({ ...data }, { status: 200 });
    }

    const db = await connectDB(req);

    const skip = (page - 1) * limit;

    const products = await db
      .collection("products")
      .find({
        categoryPath: new ObjectId(categoryId),
        discountedPrice: { $ne: 0 },
      })
      .skip(skip)
      .limit(limit)
      .toArray();

    const totalProducts = await db.collection("products").countDocuments({
      categoryPath: new ObjectId(categoryId),
      discountedPrice: { $ne: 0 },
    });

    const totalPages = Math.ceil(totalProducts / limit);

    const responseData = {
      products: products,
      totalProducts,
      totalPages,
      currentPage: page,
      categoryId,
    };

    if (redis) {
      try {
        await redis.set(cacheKey, JSON.stringify(responseData), {
          EX: 3600,
        });
      } catch (error) {
        logError("redis get error", error);
      }
    }

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
    const { categories, wipeAll = false } = await req.json();
    const db = await connectDB(req);
    const results = [];

    if (wipeAll) {
      await db.collection("products").deleteMany({});
      await db.collection("carts").updateMany({}, { $set: { items: [] } });

      try {
        await RedisClient.flushAll();
      } catch (error) {
        log("Redis flush skipped:", error);
      }
    }

    for (const categoryName of categories) {
      try {
        const config =
          categoryConfig[categoryName as keyof typeof categoryConfig];
        if (!config) {
          throw new Error(`Invalid category name: ${categoryName}`);
        }

        if (!("vertex" in config) || !config.vertex) {
          throw new Error(
            `No JioMart Vertex mapping for category: ${categoryName}`,
          );
        }

        const vertexItems = await fetchVertexProducts(config.vertex);
        if (!vertexItems.length) {
          throw new Error("No products found in JioMart response");
        }

        const categoryPath = await getCategoryPath(db, categoryName);
        const transformedProducts = (
          await transformVertexProducts(
            vertexItems,
            categoryName,
            config.vertex,
          )
        ).map((product) => ({
          ...product,
          categoryPath: categoryPath.map((id: string) => new ObjectId(id)),
        }));

        log(
          `Fetched ${vertexItems.length} items, transformed ${transformedProducts.length} products for ${categoryName}`,
        );

        if (wipeAll) {
          if (transformedProducts.length) {
            await db.collection("products").insertMany(
              transformedProducts.map((product) => ({
                ...product,
                _id: new ObjectId(),
                createdAt: new Date(),
                lastUpdated: new Date(),
              })),
            );
          }
        } else {
          for (const product of transformedProducts) {
            await db.collection("products").updateOne(
              { jiomartUid: product.jiomartUid },
              {
                $set: {
                  ...product,
                  lastUpdated: new Date(),
                },
                $setOnInsert: {
                  _id: new ObjectId(),
                  createdAt: new Date(),
                },
              },
              { upsert: true },
            );
          }
        }

        if (categoryName === "Sugar") {
          const sugarProduct = {
            name: "UTTAM SUGAR Sulphurfree Sugar (Refined Safed Cheeni)",
            categoryPath: categoryPath.map((id: string) => new ObjectId(id)),
            image:
              "https://rukminim2.flixcart.com/image/832/832/xif0q/sugar/i/a/q/-original-imagtxubkgmbwpa6.jpeg?q=70",
            discountedPrice: 0,
            price: 65,
            size: "1 kg",
            _id: new ObjectId("676da9f75763ded56d43032d"),
            category: "Sugar",
            jiomartUid: "676da9f75763ded56d43032d",
            jiomartSlug: "uttam-sugar-sulphurfree",
            skuCode: "676da9f75763ded56d43032d",
            maxQuantity: 10,
            isOutOfStock: false,
            isSmartBazaar: true,
            lastUpdated: new Date(),
          };

          await db
            .collection("products")
            .updateOne(
              { _id: sugarProduct._id },
              { $set: sugarProduct },
              { upsert: true },
            );
        }

        const categoryProducts = await db
          .collection("products")
          .find({
            categoryPath: {
              $all: categoryPath.map((id: string) => new ObjectId(id)),
            },
          })
          .toArray();

        results.push({
          category: categoryName,
          syncedProducts: transformedProducts.length,
          totalProducts: categoryProducts.length,
        });

        log(`Updated ${categoryName}: ${categoryProducts.length} products`);
      } catch (error) {
        logError(`Error processing ${categoryName}:`, error);
        results.push({
          category: categoryName,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    try {
      await RedisClient.flushAll();
    } catch (error) {
      log("Redis flush skipped:", error);
    }

    return NextResponse.json(
      {
        message: "Categories sync completed",
        wipeAll,
        results: results,
      },
      { status: 200 },
    );
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

async function getCategoryPath(db: import("mongodb").Db, categoryName: string) {
  type CategoryDoc = {
    _id?: { toString(): string };
    name: string;
    children?: CategoryDoc[];
  };

  const findPath = async (
    categories: CategoryDoc[],
    targetName: string,
    currentPath: string[] = [],
  ): Promise<string[] | null> => {
    for (const category of categories) {
      if (category.name === targetName) {
        const idStr = category._id?.toString();
        return idStr ? [...currentPath, idStr] : null;
      }

      if (category.children && category.children.length > 0) {
        const idStr = category._id?.toString();
        const path = await findPath(
          category.children,
          targetName,
          idStr ? [...currentPath, idStr] : currentPath,
        );
        if (path) return path;
      }
    }
    return null;
  };

  const categories = (await db
    .collection("categories")
    .find({})
    .toArray()) as unknown as CategoryDoc[];

  const path = await findPath(categories, categoryName);

  if (!path) {
    throw new Error(`Category path not found for: ${categoryName}`);
  }

  return path;
}
