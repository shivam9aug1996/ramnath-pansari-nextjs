import { isTokenVerified } from "@/json";
import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";
import { connectDB } from "../lib/dbconnection";

export async function POST(req, res) {
  if (req.method !== "POST") {
    return NextResponse.json(
      { message: "Method not allowed" },
      { status: 405 }
    );
  }

  try {
    const { parentCategoryId, name, image } = await req.json();

    if (!name) {
      return NextResponse.json(
        { message: "Missing category name" },
        { status: 400 }
      );
    }

    // Verify token (example function, replace with your authentication logic)
    const tokenVerificationResponse = await isTokenVerified(req);
    if (tokenVerificationResponse) {
      return tokenVerificationResponse;
    }

    const db = await connectDB(req);

    // Create new category document with a generated _id and image
    const newCategory = {
      _id: new ObjectId(),
      name,
      image: image || null, // Add image key, default to null if not provided
      children: [],
    };

    // Recursive function to find the parent category and add the new category to its children
    const addCategoryToParent = async (parentId, category) => {
      const result = await db
        .collection("categories")
        .updateOne(
          { "children._id": new ObjectId(parentId) },
          { $push: { "children.$.children": category } }
        );

      if (result.matchedCount === 0) {
        // If no parent category is found at the current level, check the top-level categories
        return db
          .collection("categories")
          .updateOne(
            { _id: new ObjectId(parentId) },
            { $push: { children: category } }
          );
      }

      return result;
    };

    // If parent category exists, update parent's children array with new category
    let result;
    if (parentCategoryId) {
      result = await addCategoryToParent(parentCategoryId, newCategory);
    } else {
      // Insert new category as a top-level category if no parent ID is provided
      result = await db.collection("categories").insertOne(newCategory);
    }

    if (result.modifiedCount === 0 && result.insertedCount === 0) {
      return NextResponse.json(
        { message: "Parent category not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        message: "Category created successfully",
        categoryData: newCategory,
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

// Helper function to project category without children
const projectCategoryWithoutChildren = (category) => ({
  _id: category._id,
  name: category.name,
  image: category.image,
});

// Function to recursively find the category by ID and return its children
const findCategoryById = (categories, id) => {
  for (const category of categories) {
    if (category._id.toString() === id) {
      return category;
    }
    const foundCategory = findCategoryById(category.children, id);
    if (foundCategory) {
      return foundCategory;
    }
  }
  return null;
};

export async function GET(req, res) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("categoryId");

    const db = await connectDB(req);

    // Find the category by ID

    if (!id) {
      // Find the category by ID
      const categories = await db.collection("categories").find({}).toArray();
      return NextResponse.json({ categories }, { status: 200 });
    }

    const category = await db
      .collection("categories")
      .findOne({ _id: new ObjectId(id) });

    if (!category) {
      return NextResponse.json(
        { message: "Category not found" },
        { status: 404 }
      );
    }
    // await new Promise((res) => {
    //   setTimeout(() => {
    //     res("hi");
    //   }, 3000);
    // });
    //throw new Error("hi");

    return NextResponse.json({ children: category.children }, { status: 200 });
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}

// export async function GET(req) {
//   try {
//     const { searchParams } = new URL(req.url);
//     const levelIds = [
//       searchParams.get("level1Id"),
//       searchParams.get("level2Id"),
//       searchParams.get("level3Id"),
//     ].filter(Boolean); // Filter out undefined or null values

//     const db = await connectDB(req);

//     // Fetch all top-level categories if no level IDs are provided
//     if (levelIds.length === 0) {
//       const categories = await db.collection("categories").find({}).toArray();
//       return NextResponse.json(
//         {
//           message: "Categories fetched successfully",
//           categories: categories,
//         },
//         { status: 200 }
//       );
//     }

//     // Fetch categories based on provided level IDs
//     let currentCategories = await db.collection("categories").find().toArray();

//     for (let i = 0; i < levelIds.length; i++) {
//       const currentLevelId = levelIds[i];

//       // Find category for current level ID
//       const category = findCategoryById(currentCategories, currentLevelId);

//       if (!category) {
//         return NextResponse.json(
//           { message: `Category for level ${i + 1} not found` },
//           { status: 404 }
//         );
//       }

//       // If it's the last level, return its children without children field
//       if (i === levelIds.length - 1) {
//         return NextResponse.json(
//           {
//             message: `Categories fetched successfully for level ${i + 1}`,
//             categories: category.children.map(projectCategoryWithoutChildren),
//           },
//           { status: 200 }
//         );
//       }

//       // Update current categories to children of current level
//       currentCategories = category.children;
//     }

//     return NextResponse.json({ message: "Invalid request" }, { status: 400 });
//   } catch (error) {
//     console.error("Error:", error);
//     return NextResponse.json(
//       { error: "Something went wrong" },
//       { status: 500 }
//     );
//   }
// }

// export async function PUT(req, res) {
//   if (req.method !== "PUT") {
//     return NextResponse.json(
//       { message: "Method not allowed" },
//       { status: 405 }
//     );
//   }

//   try {
//     const { categoryId, name } = await req.json();

//     if (!categoryId || !name) {
//       return NextResponse.json(
//         { message: "Missing category ID or name" },
//         { status: 400 }
//       );
//     }

//     // Verify token (example function, replace with your authentication logic)
//     const tokenVerificationResponse = await isTokenVerified(req);
//     if (tokenVerificationResponse) {
//       return tokenVerificationResponse;
//     }

//     const db = await connectDB(req);

//     // Check if category exists
//     const category = await db
//       .collection("categories")
//       .findOne({ _id: new ObjectId(categoryId) });

//     if (!category) {
//       return NextResponse.json(
//         { message: "Category not found" },
//         { status: 404 }
//       );
//     }

//     // Update category
//     const updatedCategory = await db
//       .collection("categories")
//       .updateOne({ _id: new ObjectId(categoryId) }, { $set: { name } });

//     // Fetch updated category data
//     const updatedCategoryData = await db
//       .collection("categories")
//       .findOne({ _id: new ObjectId(categoryId) });

//     return NextResponse.json(
//       {
//         message: "Category updated successfully",
//         categoryData: updatedCategoryData,
//       },
//       { status: 200 }
//     );
//   } catch (error) {
//     console.error("Error:", error);
//     return NextResponse.json(
//       { error: "Something went wrong" },
//       { status: 500 }
//     );
//   }
// }

// export async function DELETE(req, res) {
//   if (req.method !== "DELETE") {
//     return NextResponse.json(
//       { message: "Method not allowed" },
//       { status: 405 }
//     );
//   }

//   try {
//     const { categoryId } = await req.json();

//     if (!categoryId) {
//       return NextResponse.json(
//         { message: "Missing category ID" },
//         { status: 400 }
//       );
//     }

//     // Verify token (example function, replace with your authentication logic)
//     const tokenVerificationResponse = await isTokenVerified(req);
//     if (tokenVerificationResponse) {
//       return tokenVerificationResponse;
//     }

//     const db = await connectDB(req);

//     // Check if category exists
//     const category = await db
//       .collection("categories")
//       .findOne({ _id: new ObjectId(categoryId) });

//     if (!category) {
//       return NextResponse.json(
//         { message: "Category not found" },
//         { status: 404 }
//       );
//     }

//     // Delete category
//     await db
//       .collection("categories")
//       .deleteOne({ _id: new ObjectId(categoryId) });

//     return NextResponse.json(
//       { message: "Category deleted successfully" },
//       { status: 200 }
//     );
//   } catch (error) {
//     console.error("Error:", error);
//     return NextResponse.json(
//       { error: "Something went wrong" },
//       { status: 500 }
//     );
//   }
// }
