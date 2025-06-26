import { isTokenVerified } from "@/json";
import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";
import {
  abortTransaction,
  commitTransaction,
  connectDB,
  getClient,
  startTransaction,
} from "../lib/dbconnection";
import AsyncLock from "async-lock";

// export async function PUT(req, res) {
//   let session;
//   try {
//     const { productId, productDetails, quantity } = await req.json();
//     const { searchParams } = new URL(req.url);
//     const userId = searchParams.get("userId");

//     if (
//       !productId ||
//       !ObjectId.isValid(productId) ||
//       !productDetails ||
//       quantity < 0 ||
//       !userId
//     ) {
//       return NextResponse.json({ message: "Invalid input" }, { status: 400 });
//     }

//     const tokenVerificationResponse = await isTokenVerified(req);
//     if (tokenVerificationResponse) {
//       return tokenVerificationResponse;
//     }

//     const db = await connectDB(req);
//     const client = await getClient();
//     session = await startTransaction(client);
//     const userObjectId = new ObjectId(userId);
//     const productObjectId = new ObjectId(productId);

//     const product1 = await db
//       .collection("products")
//       .findOne({ _id: productObjectId }, { session });

//     if (!product1) {
//       await abortTransaction(session);
//       return NextResponse.json(
//         { message: "Product not found" },
//         { status: 404 }
//       );
//     }

//     // Check if the product is out of stock
//     if (product1?.isOutOfStock) {
//       await abortTransaction(session);
//       return NextResponse.json(
//         { message: "Product is out of stock" },
//         { status: 468 }
//       );
//     }

//     const cart = await db
//       .collection("carts")
//       .findOne({ userId: userObjectId }, { session });

//     if (!cart && quantity > 0) {
//       // Cart doesn't exist, create a new one
//       const product = await db
//         .collection("products")
//         .findOne({ _id: productObjectId }, { session });
//       await db.collection("carts").insertOne(
//         {
//           userId: userObjectId,
//           items: [
//             {
//               productId: productObjectId,
//               productDetails: product,
//               quantity,
//             },
//           ],
//         },
//         { session }
//       );

//       await commitTransaction(session);
//       return NextResponse.json(
//         { message: "Product added to cart" },
//         { status: 201 }
//       );
//     }

//     const product = await db
//       .collection("products")
//       .findOne({ _id: productObjectId }, { session });

//     if (cart) {
//       const itemIndex = cart.items.findIndex((item) =>
//         item.productId.equals(productObjectId)
//       );

//       let updateAction;
//       if (itemIndex === -1 && quantity > 0) {
//         // Product not in cart and quantity > 0, add it
//         updateAction = {
//           $push: {
//             items: {
//               productId: productObjectId,
//               productDetails: product,
//               quantity,
//             },
//           },
//         };
//       } else if (itemIndex !== -1 && quantity > 0) {
//         // Product in cart and quantity > 0, update it
//         updateAction = {
//           $set: {
//             [`items.${itemIndex}.quantity`]: quantity,
//             [`items.${itemIndex}.productDetails`]: product,
//           },
//         };
//       } else if (itemIndex !== -1 && quantity === 0) {
//         // Quantity is 0, remove it from cart
//         updateAction = { $pull: { items: { productId: productObjectId } } };
//       } else {
//         await commitTransaction(session);
//         return NextResponse.json(
//           { message: "Invalid operation" },
//           { status: 400 }
//         );
//       }

//       await db
//         .collection("carts")
//         .updateOne({ userId: userObjectId }, updateAction, { session });

//       console.log("Cart updated successfully", updateAction);
//       // throw new Error("hiiii4567890-");
//       await commitTransaction(session);
//       return NextResponse.json(
//         { message: "Cart updated successfully" },
//         { status: 200 }
//       );
//     }
//     await commitTransaction(session);
//     return NextResponse.json(
//       { message: "Product quantity must be greater than 0" },
//       { status: 400 }
//     );
//   } catch (error) {
//     console.error("Error88:", error?.code, error?.status);

//     await abortTransaction(session);
//     if (error?.code == 112) {
//       return NextResponse.json({ error: "Retrying" }, { status: 467 });
//     }
//     return NextResponse.json(
//       { error: "Something went wrong" },
//       { status: 500 }
//     );
//   }
// }

const lock = new AsyncLock({ timeout: 20000 });

export async function PUT(req, res) {
  let session;
  try {
    const { productId, productDetails, quantity } = await req.json();
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");

    if (
      !productId ||
      !ObjectId.isValid(productId) ||
      !productDetails ||
      quantity < 0 ||
      !userId
    ) {
      return NextResponse.json({ message: "Invalid input" }, { status: 400 });
    }

    // Acquire a lock for the userId to ensure sequential requests
    await lock.acquire(userId, async () => {
      const tokenVerificationResponse = await isTokenVerified(req);
      if (tokenVerificationResponse) {
        return tokenVerificationResponse; // Return the token verification response
      }

      const db = await connectDB(req);
      const client = await getClient();
      session = await startTransaction(client);
      const userObjectId = new ObjectId(userId);
      const productObjectId = new ObjectId(productId);

      const product1 = await db
        .collection("products")
        .findOne({ _id: productObjectId }, { session });

      if (!product1) {
        await abortTransaction(session);
        const error = new Error("Product is out of stock");
        error.code = 404;
        throw error;
      }
      console.log("juhgbnmkjhgvbnm,", product1);
      if (product1?.isOutOfStock) {
        await abortTransaction(session);
        const error = new Error("Product is out of stock");
        error.code = 468;
        throw error;
      }

      const cart = await db
        .collection("carts")
        .findOne({ userId: userObjectId }, { session });

      if (!cart && quantity > 0) {
        const product = await db
          .collection("products")
          .findOne({ _id: productObjectId }, { session });

        console.log("kjhgfdcjk", product);

        await db.collection("carts").insertOne(
          {
            userId: userObjectId,
            items: [
              {
                productId: productObjectId,
                productDetails: product,
                quantity,
              },
            ],
          },
          { session }
        );

        await commitTransaction(session);
        return NextResponse.json(
          { message: "Product added to cart" },
          { status: 201 }
        );
      }

      const product = await db
        .collection("products")
        .findOne({ _id: productObjectId }, { session });

      if (cart) {
        const itemIndex = cart.items.findIndex((item) =>
          item.productId.equals(productObjectId)
        );
        const itemQuan = cart.items.find((item) =>
          item.productId.equals(productObjectId)
        );

        let updateAction;
        let amountToBeAdd = 0;
        let amountToBeRemove = 0;
        console.log(
          "8765rdfghjklkjhgfd",
          product,
          itemQuan?.quantity,
          quantity
        );
        let quantityDiff = itemQuan?.quantity
          ? quantity - itemQuan?.quantity
          : quantity;
        console.log("8765rdfghjklkjhgfdquantityDiff", quantityDiff);
        if (itemIndex === -1 && quantity > 0) {
          updateAction = {
            $push: {
              items: {
                productId: productObjectId,
                productDetails: product,
                quantity,
              },
            },
          };
        } else if (itemIndex !== -1 && quantity > 0) {
          updateAction = {
            $set: {
              [`items.${itemIndex}.quantity`]: quantity,
              [`items.${itemIndex}.productDetails`]: product,
            },
          };
        } else if (itemIndex !== -1 && quantity === 0) {
          updateAction = { $pull: { items: { productId: productObjectId } } };
        } else {
          await commitTransaction(session);
          return NextResponse.json(
            { message: "Invalid operation" },
            { status: 400 }
          );
        }

        if (quantityDiff > 0) {
          amountToBeAdd = calculateTotalAmount([
            {
              productDetails: product,
              quantity: quantityDiff,
            },
          ]);
        } else {
          amountToBeRemove = calculateTotalAmount([
            {
              productDetails: product,
              quantity: Math.abs(quantityDiff),
            },
          ]);
        }

        const previousTotalAmount = calculateTotalAmount(cart?.items);
        const latestTotalAmount =
          previousTotalAmount + amountToBeAdd - amountToBeRemove;

        const pObId = new ObjectId("676da9f75763ded56d43032d");
        const freeItem = await db
          .collection("products")
          .findOne({ _id: pObId });

        const freeItemInCart = cart.items.findIndex((item) =>
          item.productId.equals(pObId)
        );

        console.log(
          "uytrfdfghjkfdgh",
          latestTotalAmount,
          previousTotalAmount,
          freeItem,
          freeItemInCart,
          latestTotalAmount >= 1000
        );

        await db
          .collection("carts")
          .updateOne({ userId: userObjectId }, updateAction, { session });

        if (freeItemInCart === -1 && latestTotalAmount >= 1000) {
          console.log("iu7654edvbhnjk");
          let newUpdateAction = {
            $push: {
              items: {
                productId: pObId,
                productDetails: freeItem,
                quantity: 1,
              },
            },
          };
          await db.collection("carts").updateOne(
            {
              userId: userObjectId,
            },
            newUpdateAction,
            { session }
          );
        } else if (freeItemInCart !== -1 && latestTotalAmount < 1000) {
          let newUpdateAction = { $pull: { items: { productId: pObId } } };
          await db.collection("carts").updateOne(
            {
              userId: userObjectId,
            },
            newUpdateAction,
            { session }
          );
        }

        console.log("kjhgfghjkjhg", cart);

        await commitTransaction(session);

        return NextResponse.json(
          { message: "Cart updated successfully" },
          { status: 200 }
        );
      }

      await commitTransaction(session);
      return NextResponse.json(
        { message: "Product quantity must be greater than 0" },
        { status: 400 }
      );
    });

    // End of lock acquire
    console.log("lock released");
    return NextResponse.json({ message: "lock released" }, { status: 200 });
  } catch (error) {
    console.error("Error56789:", error?.code, error?.status, error);

    await abortTransaction(session);
    if (error?.code == 112) {
      return NextResponse.json({ error: "Retrying" }, { status: 467 });
    }
    if (error?.code == 468) {
      return NextResponse.json({ error: "Product is out of stock" }, { status: 468 });
    }
    if (error?.code == 404) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}

export async function GET(req, res) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");
    // await new Promise((res) => {
    //   setTimeout(() => {
    //     res("hi");
    //   }, 30000);
    // });
    if (!userId || !ObjectId.isValid(userId)) {
      return NextResponse.json({ message: "Invalid user ID" }, { status: 400 });
    }

    const tokenVerificationResponse = await isTokenVerified(req);
    if (tokenVerificationResponse) {
      return tokenVerificationResponse;
    }

    const db = await connectDB(req);

    const cart = await db
      .collection("carts")
      .findOne({ userId: new ObjectId(userId) });
    console.log("oi87654ewsdfghjkl", cart, userId);

    if (!cart) {
      return NextResponse.json(
        { message: "Cart not found", cart: [] },
        { status: 401 }
      );
    }
    const updatedCart = moveFreeItemToTop(cart);


    return NextResponse.json({ cart: updatedCart }, { status: 200 });
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}

const calculateTotalAmount = (products: any = []): number => {
  return products?.reduce((total, product) => {
    const productTotal = product?.productDetails?.discountedPrice
      ? parseFloat(
          (
            product?.productDetails?.discountedPrice * product?.quantity
          )?.toFixed(2)
        )
      : 0;

    return parseFloat(total?.toFixed(2)) + productTotal;
  }, 0);
};


const FREE_ITEM_ID = "676da9f75763ded56d43032d";

function moveFreeItemToTop(cart) {
  if (!cart?.items?.length) return cart;

  const index = cart.items.findIndex(
    (item) => item.productId === FREE_ITEM_ID || item.productDetails?._id === FREE_ITEM_ID
  );

  if (index > 0) {
    const [freeItem] = cart?.items?.splice(index, 1); // remove it
    cart?.items?.unshift(freeItem); // move to top
  }

  return cart;
}