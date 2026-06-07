import { isTokenVerified } from "@/json";
import { ObjectId } from "mongodb";
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "../lib/dbconnection";
import { asMongoUpdate } from "@/types/api";
import type { UpdateResult, InsertOneResult, Document } from "mongodb";

export async function POST(req: NextRequest) {
  if (req.method !== "POST") {
    return NextResponse.json(
      { message: "Method not allowed" },
      { status: 405 },
    );
  }

  try {
    const { parentCategoryId, name, image } = await req.json();

    if (!name) {
      return NextResponse.json(
        { message: "Missing category name" },
        { status: 400 },
      );
    }

    const tokenVerificationResponse = await isTokenVerified(req);
    if (tokenVerificationResponse) {
      return tokenVerificationResponse;
    }

    const db = await connectDB(req);

    const newCategory = {
      _id: new ObjectId(),
      name,
      image: image || null,
      children: [],
    };

    const addCategoryToParent = async (
      parentId: string,
      category: typeof newCategory,
    ) => {
      const result = await db
        .collection("categories")
        .updateOne(
          { "children._id": new ObjectId(parentId) },
          asMongoUpdate({ $push: { "children.$.children": category } }),
        );

      if (result.matchedCount === 0) {
        return db
          .collection("categories")
          .updateOne(
            { _id: new ObjectId(parentId) },
            asMongoUpdate({ $push: { children: category } }),
          );
      }

      return result;
    };

    let result: UpdateResult<Document> | InsertOneResult<Document>;
    if (parentCategoryId) {
      result = await addCategoryToParent(parentCategoryId, newCategory);
    } else {
      result = await db.collection("categories").insertOne(newCategory);
    }

    const modifiedCount = "modifiedCount" in result ? result.modifiedCount : 0;
    const insertedCount = "insertedCount" in result ? result.insertedCount : 0;

    if (modifiedCount === 0 && insertedCount === 0) {
      return NextResponse.json(
        { message: "Parent category not found" },
        { status: 404 },
      );
    }

    return NextResponse.json(
      {
        message: "Category created successfully",
        categoryData: newCategory,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 },
    );
  }
}

type CategoryNode = {
  _id: { toString(): string };
  name: string;
  image?: string | null;
  children?: CategoryNode[];
};

const findCategoryById = (
  categories: CategoryNode[],
  id: string,
): CategoryNode | null => {
  for (const category of categories) {
    if (category._id.toString() === id) {
      return category;
    }
    const foundCategory = findCategoryById(category.children ?? [], id);
    if (foundCategory) {
      return foundCategory;
    }
  }
  return null;
};

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("categoryId");

    const db = await connectDB(req);

    if (!id) {
      const categories = await db.collection("categories").find({}).toArray();
      return NextResponse.json({ categories }, { status: 200 });
    }

    const category = await db
      .collection("categories")
      .findOne({ _id: new ObjectId(id) });

    if (!category) {
      return NextResponse.json(
        { message: "Category not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({ children: category.children }, { status: 200 });
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 },
    );
  }
}
