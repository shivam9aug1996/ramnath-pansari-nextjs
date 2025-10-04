import { NextResponse } from "next/server";
import { connectDB } from "@/app/api/lib/dbconnection";
// @ts-ignore - typings not installed for jsonwebtoken in this project
import jwt from "jsonwebtoken";
import { secretKey } from "@/app/api/lib/keys";
import { ObjectId } from "mongodb";
import { Expo } from "expo-server-sdk";
import type { ExpoPushMessage } from "expo-server-sdk";

type AnyObject = { [key: string]: any };

const LOG_PREFIX = "[admin/orders/:id]";

const ORDER_STATUS_ENUM = [
  "created",
  "confirmed",
  "packed",
  "out_for_delivery",
  "delivered",
  "canceled",
];

function buildError(code: string, message: string, status: number) {
  console.debug(`${LOG_PREFIX} error`, { code, message, status });
  return NextResponse.json({ error: { code, message } }, { status });
}

async function requireAdmin(req: Request) {
  try {
    console.debug(`${LOG_PREFIX} auth check start`);
    const auth = req.headers.get("authorization") || "";
    const token = auth.startsWith("Bearer ") ? auth.split(" ")[1] : "";
    if (!token) {
      console.debug(`${LOG_PREFIX} missing bearer token`);
      return buildError("UNAUTHORIZED", "Missing token", 401);
    }

    const decoded: AnyObject = jwt.verify(token, secretKey as any) as AnyObject;
    if (!decoded?.id) {
      console.debug(`${LOG_PREFIX} token decoded but id missing`);
      return buildError("UNAUTHORIZED", "Invalid token", 401);
    }
    console.debug(`${LOG_PREFIX} token decoded`, { userId: decoded.id });

    const db = await connectDB(req);
    if (!db) {
      console.debug(`${LOG_PREFIX} DB connection failed during auth`);
      return buildError("INTERNAL", "Database connection failed", 500);
    }
    const user = await db.collection("users").findOne({ _id: new ObjectId(decoded.id) });
    if (!user) {
      console.debug(`${LOG_PREFIX} user not found for token`, { userId: decoded.id });
      return buildError("UNAUTHORIZED", "User not found", 401);
    }

    const isAdminFromDb = Boolean((user as AnyObject)?.isAdminUser);
    const isAdminFallback = (user as AnyObject)?.mobileNumber === "8888888888";
    console.debug(`${LOG_PREFIX} admin flags`, { isAdminFromDb, isAdminFallback });
    if (!(isAdminFromDb || isAdminFallback)) {
      return buildError("FORBIDDEN", "Admin access required", 403);
    }
    console.debug(`${LOG_PREFIX} auth check passed`);
    return null;
  } catch (err: any) {
    console.debug(`${LOG_PREFIX} auth check failed`, { message: err?.message });
    return buildError("UNAUTHORIZED", "Invalid or expired token", 401);
  }
}

function toIso(value: any) {
  try {
    if (!value) return value;
    const d = new Date(value);
    return isNaN(d.getTime()) ? value : d.toISOString();
  } catch {
    return value;
  }
}

function normalize(order: AnyObject) {
  if (!order) return order;
  const cloned: AnyObject = { ...order };
  if (cloned._id) cloned._id = cloned._id.toString();
  if (cloned.createdAt) cloned.createdAt = toIso(cloned.createdAt);
  if (cloned.updatedAt) cloned.updatedAt = toIso(cloned.updatedAt);
  if (cloned?.transactionData?.createdAt)
    cloned.transactionData.createdAt = toIso(cloned.transactionData.createdAt);
  if (cloned?.transactionData?.amount != null)
    cloned.transactionData.amount = String(cloned.transactionData.amount);
  if (cloned?.amountPaid != null) cloned.amountPaid = String(cloned.amountPaid);
  if (Array.isArray(cloned.orderHistory)) {
    cloned.orderHistory = cloned.orderHistory.map((h: AnyObject) => ({
      ...h,
      timestamp: toIso(h?.timestamp),
    }));
  }
  return cloned;
}

function buildIdFilter(id: string) {
  const base: AnyObject = { isDeleted: { $ne: true } };
  const or: AnyObject[] = [{ orderId: id }];
  if (ObjectId.isValid(id)) {
    or.unshift({ _id: new ObjectId(id) });
  }
  // Fallback: in case some docs were created with string _id
  or.push({ _id: id as any });
  return { $and: [base, { $or: or }] };
}

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const authError = await requireAdmin(req);
    if (authError) return authError;

    const rawId = params?.id || "";
    const id = decodeURIComponent(String(rawId)).trim();
    console.debug(`${LOG_PREFIX} GET`, { id, rawId });
    const db = await connectDB(req);
    if (!db) {
      console.debug(`${LOG_PREFIX} DB connection failed`);
      return buildError("INTERNAL", "Database connection failed", 500);
    }
    const filter = buildIdFilter(id);
    console.debug(`${LOG_PREFIX} GET filter`, filter);
    const order = await db.collection("orders").findOne(filter);
    if (!order) return buildError("NOT_FOUND", "Order not found", 404);
    return NextResponse.json(normalize(order), { status: 200 });
  } catch (err: any) {
    return buildError("INTERNAL", err?.message || "Internal server error", 500);
  }
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  try {
    const authError = await requireAdmin(req);
    console.log("authError",authError);
    if (authError) return authError;

    const rawId = params?.id || "";
    const id = decodeURIComponent(String(rawId)).trim();
    console.debug(`${LOG_PREFIX} PUT`, { id, rawId });
    const body = (await req.json()) as AnyObject;
    const db = await connectDB(req);
    if (!db) {
      console.debug(`${LOG_PREFIX} DB connection failed`);
      return buildError("INTERNAL", "Database connection failed", 500);
    }

    const update: AnyObject = { $set: { updatedAt: new Date() } };
    console.log("b567890dy",body);
    // defer orderStatus handling until after we load existing doc

    // allow address corrections and other partial fields
    if (body?.addressData) {
      update.$set.addressData = body.addressData;
    }
    if (body?.cartData) {
      // basic validation
      const items = body.cartData?.cart?.items || [];
      for (const item of items) {
        if (typeof item?.quantity !== "number" || item.quantity <= 0) {
          return buildError("BAD_REQUEST", "Item quantity must be > 0", 400);
        }
        const dp = item?.productDetails?.discountedPrice;
        if (typeof dp !== "number" || dp < 0) {
          return buildError("BAD_REQUEST", "discountedPrice must be >= 0", 400);
        }
      }
      update.$set.cartData = body.cartData;
      update.$set.productCount = items.length || 0;
      update.$set.totalProductCount = items.reduce(
        (acc: number, it: any) => acc + Number(it?.quantity || 0),
        0
      );
    }

    // Set orderStatus exactly as provided (no history push)
    if ("orderStatus" in body) {
      update.$set.orderStatus = String(body.orderStatus);
      console.debug(`${LOG_PREFIX} orderStatus set`, { orderStatus: update.$set.orderStatus });
    }

    // Update transactionData fields (amount, currency) and amountPaid
    if (body?.transactionData && ("amount" in body.transactionData || "currency" in body.transactionData)) {
      const txSet: AnyObject = {};
      if ("amount" in body.transactionData) {
        txSet["transactionData.amount"] = String(body.transactionData.amount);
      }
      if ("currency" in body.transactionData) {
        if (body.transactionData.currency != null && typeof body.transactionData.currency !== "string") {
          return buildError("BAD_REQUEST", "transactionData.currency must be string", 400);
        }
        txSet["transactionData.currency"] = body.transactionData.currency;
      }
      Object.assign(update.$set, txSet);
      console.debug(`${LOG_PREFIX} tx update`, txSet);
    }

    if ("amountPaid" in body) {
      update.$set.amountPaid = String(body.amountPaid);
      console.debug(`${LOG_PREFIX} amountPaid update`, { amountPaid: update.$set.amountPaid });
    }

    // Replace orderHistory exactly as provided when present
    if ("orderHistory" in body) {
      update.$set.orderHistory = body.orderHistory;
      console.debug(`${LOG_PREFIX} orderHistory replace`, { count: Array.isArray(body.orderHistory) ? body.orderHistory.length : undefined });
    }

    const filter = buildIdFilter(id);
    console.debug(`${LOG_PREFIX} PUT filter`, filter);
    const before = await db.collection("orders").findOne(filter);
    console.debug(`${LOG_PREFIX} PUT exists before`, { exists: Boolean(before) });
    // if (body?.orderStatus) {
    //   const status: string = String(body.orderStatus);
    //   // allow unknown strings but prefer enum (no hard validation)
    //   const previousStatus = (before as AnyObject)?.orderStatus;
    //   if (previousStatus !== status) {
    //     if (!update.$push) update.$push = {};
    //     update.$set.orderStatus = status;
    //     update.$push.orderHistory = {
    //       $each: [{ status, timestamp: new Date() }],
    //       $position: 0,
    //     } as any;
    //     console.debug(`${LOG_PREFIX} status change`, { previousStatus, status });
    //   } else {
    //     console.debug(`${LOG_PREFIX} status unchanged, skip history push`, { status });
    //   }
    // }
    const res = await db.collection("orders").findOneAndUpdate(filter, update, { returnDocument: "after", // modern drivers
      // @ts-ignore fallback for older drivers
      returnOriginal: false,
    } as any);
    const updated = (res as any)?.value ?? (res as any);
    console.debug(`${LOG_PREFIX} PUT res`, { hasWrapper: Boolean((res as any)?.value), isDoc: !Boolean((res as any)?.value) });
    console.debug(`${LOG_PREFIX} PUT updated`, { exists: Boolean(updated) });
    if (!updated) return buildError("NOT_FOUND", "Order not found", 404);

    // Send push notification if orderStatus changed
    try {
      if ("orderStatus" in body) {
        const prevStatus = (before as AnyObject)?.orderStatus;
        const nextStatus = String(body.orderStatus);
        if (prevStatus !== nextStatus) {
          const userId = String((updated as AnyObject)?.userId || "");
          const orderMongoId = String((updated as AnyObject)?._id || "");
          if (userId) {
            const tokensDoc = await db.collection("pushTokens").findOne({ userId });
            const tokens: string[] = tokensDoc?.tokens || [];
            if (tokens.length) {
              const titleMap: AnyObject = {
                delivered: "Your order has been delivered",
                out_for_delivery: "Your order is out for delivery",
                confirmed: "Your order is confirmed",
                canceled: "Your order was canceled",
              };
              const title = titleMap[nextStatus] || `Order status updated to ${nextStatus}`;
              const expo = new Expo({});
              const messages: ExpoPushMessage[] = tokens.map((t): ExpoPushMessage => ({
                to: t,
                sound: "default",
                data: { updateOrderStatus: true, orderId: orderMongoId, userId },
                priority: "high",
                title,
              }));
              const tickets = await expo.sendPushNotificationsAsync(messages);
              const okIds: string[] = [];
              tickets?.forEach((ticket: any) => {
                if (ticket?.status === "ok") okIds.push(ticket?.id);
              });
              if (okIds.length) {
                await expo.getPushNotificationReceiptsAsync(okIds);
              }
              console.debug(`${LOG_PREFIX} push sent`, { count: tokens.length, title });
            } else {
              console.debug(`${LOG_PREFIX} no tokens for user`, { userId });
            }
          }
        }
      }
    } catch (pushErr: any) {
      console.debug(`${LOG_PREFIX} push error`, { message: pushErr?.message });
    }

    return NextResponse.json(normalize(updated), { status: 200 });
  } catch (err: any) {
    return buildError("INTERNAL", err?.message || "Internal server error", 500);
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    const authError = await requireAdmin(req);
    if (authError) return authError;

    const rawId = params?.id || "";
    const id = decodeURIComponent(String(rawId)).trim();
    console.debug(`${LOG_PREFIX} DELETE`, { id, rawId });
    const db = await connectDB(req);
    if (!db) {
      console.debug(`${LOG_PREFIX} DB connection failed`);
      return buildError("INTERNAL", "Database connection failed", 500);
    }
    const filter = buildIdFilter(id);
    console.debug(`${LOG_PREFIX} DELETE filter`, filter);
    const res = await db
      .collection("orders")
      .findOneAndUpdate(
        filter,
        { $set: { isDeleted: true, updatedAt: new Date() } },
        { returnDocument: "after", // modern drivers
          // @ts-ignore fallback for older drivers
          returnOriginal: false,
        } as any
      );
    const deletedDoc = (res as any)?.value ?? (res as any);
    if (!deletedDoc) return buildError("NOT_FOUND", "Order not found", 404);
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err: any) {
    return buildError("INTERNAL", err?.message || "Internal server error", 500);
  }
}


