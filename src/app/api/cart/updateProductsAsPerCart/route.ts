import { isTokenVerified } from "@/json";
import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";
import { connectDB } from "../../lib/dbconnection";
import AsyncLock from "async-lock";
import { baseUrl } from "../../constants";

const lock = new AsyncLock({ timeout: 20000 });

export async function PUT(req) {
  try {
    const { items } = await req.json();
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");

    if (!userId || !Array.isArray(items)) {
      return NextResponse.json({ message: "Invalid input" }, { status: 400 });
    }

    return await lock.acquire(userId, async () => {
      const tokenVerificationResponse = await isTokenVerified(req);
      const userToken = req.headers.get("authorization")?.split(" ")[1];

      if (tokenVerificationResponse) return tokenVerificationResponse;

      const db = await connectDB(req);
      let itemsArray = items?.map((item) => {
        return item?.productId;
      });

      // Make external API call to sync products
      let latestProducts = []
      try {
        const response = await fetch(`${baseUrl}/products/update`, {
          method: "PATCH",
          body: JSON.stringify({ products: itemsArray }),
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${userToken}`,
          },
        });

        if (!response.ok) {
          throw new Error(`External API call failed: ${response.status}`);
        }
        const data = await response.json()
        latestProducts = data?.results;
        console.log("kjhgfdfghjh87656776543890gfghjk", data);
      } catch (error) {
        console.error("Error calling products API:", error);
        return NextResponse.json(
          { error: "Failed to sync products" },
          { status: 500 }
        );
      }

      let updatedItems = [];
    //   try {
    //     const cart = await db
    //       .collection("carts")
    //       .findOne({ userId: new ObjectId(userId) });
    //     console.log("kjhgfdfghjh876567890gfghjk", JSON.stringify(cart));
    //     if (cart && cart?.items?.length > 0) {
    //       //here i will update the quantity of the products in the cart according to maxQuantity
    //       updatedItems = cart?.items?.map((item) => {
    //         const product = latestProducts?.find(
    //           (i) => i?.productId?.toString() === item?.productId?.toString()
    //         );
    //         console.log("kjhgfdfghjh667890gfghjk", product);
    //         return {
    //           ...item,
    //           maxQuantity: product?.newMaxQuantity,
    //         };
    //       });
    //     }
    //     console.log("kjhgfdfghjhgfghjk", updatedItems);
    //     const updatedItems2 = items?.map((item) => {
    //       const product = cart?.items?.find(
    //         (i) => i?.productId?.toString() === item?.productId?.toString()
    //       );
    //       return {
    //         ...item,
    //         quantity: product?.quantity>product?.productDetails?.maxQuantity?product?.productDetails?.maxQuantity:product?.quantity,
    //       };
    //     });
    //     return NextResponse.json(
    //       {
    //         message: "Updated products as per cart successfully",
    //         data: updatedItems2,
    //       },
    //       { status: 200 }
    //     );
    //     // const response = await fetch(`${baseUrl}/cart/bulk`, {
    //     //     method: "PATCH",
    //     //     body: JSON.stringify({ items: items}),
    //     //     headers: {
    //     //       "Content-Type": "application/json",
    //     //       Authorization: `Bearer ${userToken}`,
    //     //     },
    //     //   });
    //   } catch (error) {}

      return NextResponse.json(
        {
          message: "Updated products as per cart successfully",
          data: updatedItems,
        },
        { status: 200 }
      );
    });
  } catch (error) {
    console.error("Error in updateProductsAsPerCart:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}

// ... existing findCategoryNameById function ...

const findCategoryNameById = async (categories, targetId) => {
  for (const category of categories) {
    if (category._id.toString() === targetId) {
      return category.name;
    }

    if (category.children && category.children.length > 0) {
      for (const child of category.children) {
        if (child._id.toString() === targetId) {
          return child.name;
        }

        if (child.children && child.children.length > 0) {
          for (const grandChild of child.children) {
            if (grandChild._id.toString() === targetId) {
              return grandChild.name;
            }
          }
        }
      }
    }
  }
  return null;
};
