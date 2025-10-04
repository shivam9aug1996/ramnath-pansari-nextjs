import { isTokenVerified } from "@/json";
import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";
import {
  abortTransaction,
  commitTransaction,
  connectDB,
  getClient,
  startTransaction,
} from "../../lib/dbconnection";
import AsyncLock from "async-lock";

const lock = new AsyncLock({ timeout: 20000 });

export async function PUT(req) {
    let session;
    try {
      const { items } = await req.json();
      const { searchParams } = new URL(req.url);
      const userId = searchParams.get("userId");
  
      if (!userId || !Array.isArray(items)) {
        return NextResponse.json({ message: "Invalid input" }, { status: 400 });
      }
  
      const failedItems = [];
  
     return await lock.acquire(userId, async () => {
        const tokenVerificationResponse = await isTokenVerified(req);
        if (tokenVerificationResponse) return tokenVerificationResponse;
  
        const db = await connectDB(req);
        const client = await getClient();
        session = await startTransaction(client);
  
        const userObjectId = new ObjectId(userId);
        let cart = await db.collection("carts").findOne({ userId: userObjectId }, { session });
  
        if (!cart) {
          await db.collection("carts").insertOne({ userId: userObjectId, items: [] }, { session });
          cart = await db.collection("carts").findOne({ userId: userObjectId }, { session });
        }
  
        let updatedItems = [];
  
        for (const item of items) {
          const { productId, quantity } = item;
  
          if (!ObjectId.isValid(productId) || typeof quantity !== "number" || quantity < 0) {
            failedItems.push({ productId, reason: "Invalid Input" });
            continue;
          }
  
          const productObjectId = new ObjectId(productId);
          const product = await db.collection("products").findOne({ _id: productObjectId }, { session });
  
          if (!product) {
            failedItems.push({ productId, reason: "Not Found" });
            continue;
          }
  
          if (product.isOutOfStock) {
            failedItems.push({ productId, reason: "Out of Stock" });
            continue;
          }
  
          const itemIndex = updatedItems.findIndex(i => i.productId.equals(productObjectId));
          const existingItem = updatedItems[itemIndex];
          const oldQuantity = existingItem?.quantity || 0;
          const adjustedQuantity = product.maxQuantity 
          ? Math.min(quantity, product.maxQuantity) 
          : quantity;
          if (itemIndex === -1 && adjustedQuantity > 0) {
            updatedItems.push({ productId: productObjectId, quantity: adjustedQuantity, productDetails: product });
          } else if (itemIndex !== -1 && adjustedQuantity > 0) {
            updatedItems[itemIndex].quantity = adjustedQuantity;
            updatedItems[itemIndex].productDetails = product;
          } else if (itemIndex !== -1 && adjustedQuantity === 0) {
            updatedItems.splice(itemIndex, 1);
          }
        }
  
        const latestTotalAmount = calculateTotalAmount(updatedItems);
        const pObId = new ObjectId("676da9f75763ded56d43032d");
        const freeItem = await db.collection("products").findOne({ _id: pObId }, { session });
        const freeItemIndex = updatedItems.findIndex(i => i.productId.equals(pObId));
  
        if (latestTotalAmount >= 1000 && freeItemIndex === -1 && freeItem) {
          updatedItems.unshift({ productId: pObId, productDetails: freeItem, quantity: 1 });
        } else if (latestTotalAmount < 1000 && freeItemIndex !== -1) {
          updatedItems.splice(freeItemIndex, 1);
        }
  
        await db.collection("carts").updateOne(
          { userId: userObjectId },
          { $set: { items: updatedItems } },
          { session }
        );
  
        await commitTransaction(session);
  
        return NextResponse.json({
          message: "Cart updated successfully",
          failedItems
        }, { status: 200 });
     
    });
    } catch (error) {
      await abortTransaction(session);
      console.error("Error in bulk updateCart:", error);
      return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
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
  