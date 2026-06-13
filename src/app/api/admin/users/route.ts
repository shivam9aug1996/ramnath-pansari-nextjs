import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { connectDB } from "@/app/api/lib/dbconnection";
import { requireAdmin } from "@/app/api/admin/requireAdmin";
import {
  buildUserListFilter,
  buildUserSearchFilter,
  hashPassword,
  normalizeUserForResponse,
  validateUserCreateInput,
} from "@/app/api/admin/users/userUtils";

function buildError(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export async function GET(req: Request) {
  const authError = await requireAdmin(req);
  if (authError) return authError;

  try {
    const { searchParams } = new URL(req.url);
    const page = Math.max(parseInt(searchParams.get("page") || "1", 10), 1);
    const limit = Math.max(parseInt(searchParams.get("limit") || "20", 10), 1);
    const search = (searchParams.get("search") || "").trim();
    const role = (searchParams.get("role") || "").trim();

    const db = await connectDB(req);
    const baseFilter = buildUserListFilter(role);
    const searchFilter = buildUserSearchFilter(search);
    const finalFilter =
      Object.keys(searchFilter).length > 0
        ? { $and: [baseFilter, searchFilter] }
        : baseFilter;

    const skip = (page - 1) * limit;
    const usersRaw = await db
      .collection("users")
      .find(finalFilter)
      .sort({ _id: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();

    const totalCount = await db.collection("users").countDocuments(finalFilter);
    const totalPages = Math.max(Math.ceil(totalCount / limit), 1);
    const users = usersRaw
      .map((user) => normalizeUserForResponse(user as never))
      .filter(Boolean);

    return NextResponse.json({
      users,
      currentPage: page,
      totalPages,
      totalCount,
    });
  } catch (error) {
    console.error("[admin/users] GET error:", error);
    return buildError("INTERNAL", "Failed to fetch users", 500);
  }
}

export async function POST(req: Request) {
  const authError = await requireAdmin(req);
  if (authError) return authError;

  try {
    const body = await req.json();
    const validation = validateUserCreateInput(body);
    if (!validation.valid) {
      return buildError("VALIDATION", validation.message ?? "Invalid input", 400);
    }

    const db = await connectDB(req);
    const existing = await db.collection("users").findOne({
      mobileNumber: validation.mobileNumber,
    });
    if (existing) {
      return buildError("CONFLICT", "Mobile number already registered", 409);
    }

    const passwordHash = await hashPassword(validation.password!);
    const now = new Date();
    const payload = {
      mobileNumber: validation.mobileNumber,
      password: passwordHash,
      ...(validation.name ? { name: validation.name } : {}),
      ...(validation.isAdminUser ? { isAdminUser: true } : {}),
      createdAt: now,
    };

    const result = await db.collection("users").insertOne(payload);
    await db.collection("carts").insertOne({
      userId: new ObjectId(result.insertedId),
      items: [],
    });

    const created = await db
      .collection("users")
      .findOne({ _id: result.insertedId });

    return NextResponse.json(
      { user: normalizeUserForResponse(created as never) },
      { status: 201 },
    );
  } catch (error) {
    console.error("[admin/users] POST error:", error);
    return buildError("INTERNAL", "Failed to create user", 500);
  }
}
