import { isTokenVerified } from "@/json";
import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";
import { connectDB } from "../lib/dbconnection";
import redisClient from "../lib/redisClient";

export async function POST(req, res) {
  if (req.method !== "POST") {
    return NextResponse.json(
      { message: "Method not allowed" },
      { status: 405 }
    );
  }

  try {
    const { name, categoryPath, image, discountedPrice, price } =
      await req.json();

    if (
      !name ||
      !categoryPath ||
      !Array.isArray(categoryPath) ||
      categoryPath.length === 0 ||
      !discountedPrice ||
      !price
    ) {
      return NextResponse.json(
        { message: "Missing required fields" },
        { status: 400 }
      );
    }

    // Verify token (example function, replace with your authentication logic)
    const tokenVerificationResponse = await isTokenVerified(req);
    if (tokenVerificationResponse) {
      return tokenVerificationResponse;
    }

    const db = await connectDB(req);

    // Create new product document with a generated _id and image
    const newProduct = {
      _id: new ObjectId(),
      name,
      categoryPath: categoryPath.map((id) => new ObjectId(id)),
      image: image || null, // Add image key, default to null if not provided
      discountedPrice,
      price,
    };

    // Insert new product into the products collection
    const result = await db.collection("products").insertOne(newProduct);

    if (result.insertedCount === 0) {
      return NextResponse.json(
        { message: "Product creation failed" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        message: "Product created successfully",
        productData: newProduct,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}

export async function GET(req, res) {
  try {
    const { searchParams } = new URL(req.url);
    const categoryId = searchParams.get("categoryId");
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "10", 10);

    if (!categoryId) {
      return NextResponse.json(
        { message: "Missing category ID" },
        { status: 400 }
      );
    }

    // Verify token (example function, replace with your authentication logic)
    const tokenVerificationResponse = await isTokenVerified(req);
    if (tokenVerificationResponse) {
      return tokenVerificationResponse;
    }

    const cacheKey = `products:${categoryId}:page:${page}:limit:${limit}`;
    console.log("iuytrdfghjkl", cacheKey);

    const cachedData = await redisClient.get(cacheKey);

    // if (cachedData) {
    //   console.log("cached76544567890");
    //   let data = JSON.parse(cachedData);
    //   // await new Promise((res) => {
    //   //   setTimeout(() => {
    //   //     res("hi");
    //   //   }, 500);
    //   // });

    //   return NextResponse.json({ ...data }, { status: 200 });
    // }

    const db = await connectDB(req);
    // await new Promise((res) => {
    //   setTimeout(() => {
    //     res("hi");
    //   }, 3000);
    // });

    // Calculate the number of documents to skip
    const skip = (page - 1) * limit;

    // Find products where categoryPath contains the specified category ID
    const products = await db
      .collection("products")
      .find({ categoryPath: new ObjectId(categoryId) })
      .skip(skip)
      .limit(limit)
      .toArray();
    // await new Promise((res) => {
    //   setTimeout(() => {
    //     res("hi");
    //   }, 3000);
    // });
    // Get the total count of documents for the category (for calculating total pages)
    const totalProducts = await db
      .collection("products")
      .countDocuments({ categoryPath: new ObjectId(categoryId) });

    const totalPages = Math.ceil(totalProducts / limit);

    const responseData = {
      products,
      totalProducts,
      totalPages,
      currentPage: page,
      categoryId,
    };

    // await redisClient.set(cacheKey, JSON.stringify(responseData), {
    //   EX: 3600, // 3600 seconds = 1 hour
    // });

    return NextResponse.json(responseData, { status: 200 });
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}

// Helper function to generate a random price
const getRandomPrice = (min, max) => {
  return parseFloat((Math.random() * (max - min) + min).toFixed(2));
};

export async function PUT(req, res) {
  if (req.method !== "PUT") {
    return NextResponse.json(
      { message: "Method not allowed" },
      { status: 405 }
    );
  }

  try {
    // Verify token (example function, replace with your authentication logic)
    const tokenVerificationResponse = await isTokenVerified(req);
    if (tokenVerificationResponse) {
      return tokenVerificationResponse;
    }

    const db = await connectDB(req);

    // Define the range for random price and discounted price
    const priceMin = 10;
    const priceMax = 1000;
    const discountedPriceMin = 5;
    const discountedPriceMax = 500;

    // Update all products with random price and discountedPrice, and ensure image is an array
    const result = await db.collection("products").updateMany(
      {},
      {
        $set: {
          price: getRandomPrice(priceMin, priceMax),
          discountedPrice: getRandomPrice(
            discountedPriceMin,
            discountedPriceMax
          ),
        },
      }
    );

    if (result.modifiedCount === 0) {
      return NextResponse.json(
        { message: "No products were updated" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        message: "Products updated successfully",
        modifiedCount: result.modifiedCount,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
