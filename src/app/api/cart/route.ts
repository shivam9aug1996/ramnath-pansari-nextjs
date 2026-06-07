import { isTokenVerified } from "@/json";
import { ObjectId } from "mongodb";
import { NextRequest, NextResponse } from "next/server";
import type { ClientSession } from "mongodb";
import { ApiError, asMongoUpdate, CartItem } from "@/types/api";
import {
  abortTransaction,
  commitTransaction,
  connectDB,
  getClient,
  startTransaction,
} from "../lib/dbconnection";
import AsyncLock from "async-lock";
import { log, logError } from "../lib/logger";

const lock = new AsyncLock({ timeout: 20000 });

export async function PUT(req: NextRequest) {
  let session: ClientSession | undefined;
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

    await lock.acquire(userId, async () => {
      const tokenVerificationResponse = await isTokenVerified(req);
      if (tokenVerificationResponse) {
        return tokenVerificationResponse;
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
        const error: ApiError = new Error("Product is out of stock");
        error.code = 404;
        throw error;
      }
      log("cart product check", product1?._id);
      if (product1?.isOutOfStock) {
        await abortTransaction(session);
        const error: ApiError = new Error("Product is out of stock");
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

        log("cart new item product", product?._id);

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
          { session },
        );

        await commitTransaction(session);
        return NextResponse.json(
          { message: "Product added to cart" },
          { status: 201 },
        );
      }

      const product = await db
        .collection("products")
        .findOne({ _id: productObjectId }, { session });

      if (cart) {
        const itemIndex = cart.items.findIndex((item: CartItem) =>
          item.productId.equals(productObjectId),
        );
        const itemQuan = cart.items.find((item: CartItem) =>
          item.productId.equals(productObjectId),
        );

        let updateAction;
        let amountToBeAdd = 0;
        let amountToBeRemove = 0;
        let quantityDiff = itemQuan?.quantity
          ? quantity - itemQuan?.quantity
          : quantity;
        log("cart quantity diff", { quantityDiff, productId });
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
            { status: 400 },
          );
        }

        if (quantityDiff > 0) {
          amountToBeAdd = calculateTotalAmount([
            {
              productId: productObjectId,
              productDetails: product,
              quantity: quantityDiff,
            },
          ]);
        } else {
          amountToBeRemove = calculateTotalAmount([
            {
              productId: productObjectId,
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

        const freeItemInCart = cart.items.findIndex((item: CartItem) =>
          item.productId.equals(pObId),
        );

        log("cart free item check", {
          latestTotalAmount,
          previousTotalAmount,
          freeItemInCart,
        });

        await db
          .collection("carts")
          .updateOne({ userId: userObjectId }, asMongoUpdate(updateAction), {
            session,
          });

        if (freeItemInCart === -1 && latestTotalAmount >= 1000) {
          log("cart adding free item");
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
            asMongoUpdate(newUpdateAction),
            { session },
          );
        } else if (freeItemInCart !== -1 && latestTotalAmount < 1000) {
          let newUpdateAction = { $pull: { items: { productId: pObId } } };
          await db.collection("carts").updateOne(
            {
              userId: userObjectId,
            },
            asMongoUpdate(newUpdateAction),
            { session },
          );
        }

        await commitTransaction(session);

        return NextResponse.json(
          { message: "Cart updated successfully" },
          { status: 200 },
        );
      }

      await commitTransaction(session);
      return NextResponse.json(
        { message: "Product quantity must be greater than 0" },
        { status: 400 },
      );
    });

    log("cart lock released");
    return NextResponse.json({ message: "lock released" }, { status: 200 });
  } catch (error) {
    const apiError = error as ApiError;
    logError("cart PUT error:", apiError?.code, apiError?.status, error);

    if (session) await abortTransaction(session);
    if (apiError?.code == 112) {
      return NextResponse.json({ error: "Retrying" }, { status: 467 });
    }
    if (apiError?.code == 468) {
      return NextResponse.json(
        { error: "Product is out of stock" },
        { status: 468 },
      );
    }
    if (apiError?.code == 404) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 },
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");

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

    if (!cart) {
      return NextResponse.json(
        { cart: { userId, items: [] } },
        { status: 200 },
      );
    }
    const updatedCart = moveFreeItemToTop(cart);

    return NextResponse.json({ cart: updatedCart }, { status: 200 });
  } catch (error) {
    logError("cart GET error:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 },
    );
  }
}

const calculateTotalAmount = (products: CartItem[] = []): number => {
  return products?.reduce((total: number, product: CartItem) => {
    const details = product?.productDetails as
      | { discountedPrice?: number }
      | null
      | undefined;
    const productTotal = details?.discountedPrice
      ? parseFloat((details.discountedPrice * product?.quantity)?.toFixed(2))
      : 0;

    return parseFloat(total?.toFixed(2)) + productTotal;
  }, 0);
};

const FREE_ITEM_ID = "676da9f75763ded56d43032d";

function moveFreeItemToTop(cart: {
  items?: CartItem[];
  [key: string]: unknown;
}) {
  if (!cart?.items?.length) return cart;

  const index = cart.items.findIndex(
    (item: CartItem) =>
      item.productId?.toString() === FREE_ITEM_ID ||
      (item.productDetails as { _id?: string })?._id?.toString() ===
        FREE_ITEM_ID,
  );

  if (index > 0) {
    const [freeItem] = cart?.items?.splice(index, 1);
    cart?.items?.unshift(freeItem);
  }

  return cart;
}
