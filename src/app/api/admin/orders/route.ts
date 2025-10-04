import { NextResponse } from "next/server";
import { connectDB } from "@/app/api/lib/dbconnection";
// @ts-ignore - typings not installed for jsonwebtoken in this project
import jwt from "jsonwebtoken";
import { secretKey } from "@/app/api/lib/keys";

type AnyObject = { [key: string]: any };

const LOG_PREFIX = "[admin/orders]";

const ORDER_STATUS_ENUM = [
  "created",
  "confirmed",
  "packed",
  "out_for_delivery",
  "delivered",
  "canceled", // accommodate existing spelling used elsewhere
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
    const user = await db.collection("users").findOne({ _id: new (await import("mongodb")).ObjectId(decoded.id) });
    if (!user) {
      console.debug(`${LOG_PREFIX} user not found for token`, { userId: decoded.id });
      return buildError("UNAUTHORIZED", "User not found", 401);
    }

    const isAdminFromDb = Boolean((user as AnyObject)?.isAdminUser);
    const isAdminFallback = (user as AnyObject)?.mobileNumber === "8888888888"; // existing convention in project
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

function normalizeOrderForResponse(order: AnyObject) {
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

function buildSearchFilter(search: string) {
  if (!search) return {};
  const regex = { $regex: search, $options: "i" } as AnyObject;
  return {
    $or: [
      { orderId: regex },
      { "addressData.name": regex },
      { "addressData.phone": regex },
      { "addressData.mobileNumber": regex },
    ],
  } as AnyObject;
}

function validateCartData(cartData: AnyObject) {
  if (!cartData?.cart?.items) return { valid: true };
  for (const item of cartData.cart.items) {
    if (typeof item?.quantity !== "number" || item.quantity <= 0) {
      return { valid: false, message: "Item quantity must be > 0" };
    }
    const discountedPrice = item?.productDetails?.discountedPrice;
    if (typeof discountedPrice !== "number" || discountedPrice < 0) {
      return { valid: false, message: "discountedPrice must be >= 0" };
    }
  }
  return { valid: true };
}

function storeImages(cart: AnyObject) {
  const images: any[] = [];
  cart?.items?.forEach((item: any) => {
    const image = item?.productDetails?.image;
    if (image && images.length < 3) images.push(image);
  });
  return images;
}

function getTotalProductCount(cart: AnyObject) {
  let total = 0;
  cart?.items?.forEach((item: any) => {
    total += Number(item?.quantity || 0);
  });
  return total;
}

export async function GET(req: Request) {
  try {
    const authError = await requireAdmin(req);
    if (authError) return authError;

    const { searchParams } = new URL(req.url);
    const page = Math.max(parseInt(searchParams.get("page") || "1", 10), 1);
    const limit = Math.max(parseInt(searchParams.get("limit") || "20", 10), 1);
    const status = (searchParams.get("status") || "").trim();
    const search = (searchParams.get("search") || "").trim();
    console.debug(`${LOG_PREFIX} GET query`, { page, limit, status, search });

    const db = await connectDB(req);
    if (!db) {
      console.debug(`${LOG_PREFIX} DB connection failed`);
      return buildError("INTERNAL", "Database connection failed", 500);
    }

    const filter: AnyObject = { isDeleted: { $ne: true } };
    if (status) filter.orderStatus = status;
    const searchFilter = buildSearchFilter(search);
    const finalFilter = Object.keys(searchFilter).length ? { $and: [filter, searchFilter] } : filter;
    console.debug(`${LOG_PREFIX} GET filter`, finalFilter);

    const skip = (page - 1) * limit;
    console.debug(`${LOG_PREFIX} GET pagination`, { skip, limit });
    const cursor = db
      .collection("orders")
      .find(finalFilter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    const ordersRaw = await cursor.toArray();
    console.debug(`${LOG_PREFIX} GET fetched`, { count: ordersRaw?.length || 0 });
    const orders = ordersRaw.map(normalizeOrderForResponse);

    const totalCount = await db.collection("orders").countDocuments(finalFilter);
    const totalPages = Math.max(Math.ceil(totalCount / limit), 1);
    console.debug(`${LOG_PREFIX} GET totals`, { totalCount, totalPages });

    return NextResponse.json({ orders, currentPage: page, totalPages }, { status: 200 });
  } catch (err: any) {
    console.debug(`${LOG_PREFIX} GET error`, { message: err?.message });
    return buildError("INTERNAL", err?.message || "Internal server error", 500);
  }
}

export async function POST(req: Request) {
  try {
    const authError = await requireAdmin(req);
    if (authError) return authError;

    const body = (await req.json()) as AnyObject;
    const { cartData, transactionData = {}, addressData = {}, orderStatus } = body || {};
    console.debug(`${LOG_PREFIX} POST body shape`, {
      hasCartData: Boolean(cartData),
      hasTx: Boolean(transactionData),
      hasAddress: Boolean(addressData),
      orderStatus,
    });

    // Validation
    const cartValidation = validateCartData(cartData);
    if (!cartValidation.valid) {
      console.debug(`${LOG_PREFIX} POST validation failed`, { message: cartValidation.message });
      return buildError("BAD_REQUEST", cartValidation.message!, 400);
    }

    const txAmount = transactionData?.amount;
    if (txAmount != null && typeof txAmount !== "string") {
      transactionData.amount = String(txAmount);
    }
    if (transactionData?.currency && typeof transactionData.currency !== "string") {
      return buildError("BAD_REQUEST", "transactionData.currency must be string", 400);
    }

    const db = await connectDB(req);
    if (!db) {
      console.debug(`${LOG_PREFIX} DB connection failed`);
      return buildError("INTERNAL", "Database connection failed", 500);
    }
    const orderId = (require("order-id")("key")).generate();

    const now = new Date();
    const imgArr = storeImages(cartData?.cart);
    const initialStatus = orderStatus || "created";
    console.debug(`${LOG_PREFIX} POST creating`, { orderId, initialStatus });

    const doc: AnyObject = {
      transactionData: {
        ...transactionData,
        createdAt: transactionData?.createdAt ? new Date(transactionData.createdAt) : now,
      },
      cartData,
      addressData,
      orderStatus: initialStatus,
      createdAt: now,
      updatedAt: now,
      orderId,
      userId: body?.userId,
      imgArr,
      productCount: cartData?.cart?.items?.length || 0,
      totalProductCount: getTotalProductCount(cartData?.cart),
      orderHistory: [{ status: initialStatus, timestamp: now }],
      amountPaid: transactionData?.amount ? Number(transactionData.amount) : 0,
    };

    const result = await db.collection("orders").insertOne(doc);
    console.debug(`${LOG_PREFIX} POST inserted`, { insertedId: result?.insertedId?.toString?.() });
    const created = await db.collection("orders").findOne({ _id: result.insertedId });
    return NextResponse.json(normalizeOrderForResponse(created as AnyObject), { status: 201 });
  } catch (err: any) {
    console.debug(`${LOG_PREFIX} POST error`, { message: err?.message });
    return buildError("INTERNAL", err?.message || "Internal server error", 500);
  }
}


