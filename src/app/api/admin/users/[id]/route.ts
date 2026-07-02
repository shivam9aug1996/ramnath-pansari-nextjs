import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import type { ClientSession } from "mongodb";
import { connectDB, getClient, startTransaction, commitTransaction, abortTransaction } from "@/app/api/lib/dbconnection";
import { requireAdmin } from "@/app/api/admin/requireAdmin";
import { verifyJwt } from "@/app/api/lib/jwt";
import { deleteImage } from "@/app/api/lib/global";
import {
  countAdminUsers,
  hashPassword,
  normalizeUserForResponse,
  resolveIsAdmin,
  validateUserUpdateInput,
} from "@/app/api/admin/users/userUtils";

type RouteContext = { params: Promise<{ id: string }> };

function buildError(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

async function getRequestUserId(req: Request) {
  try {
    const auth = req.headers.get("authorization") || "";
    const token = auth.startsWith("Bearer ") ? auth.split(" ")[1] : "";
    if (!token) return null;
    const decoded = (await verifyJwt(token)) as { id?: string } | null;
    return decoded?.id ?? null;
  } catch {
    return null;
  }
}

export async function GET(req: Request, context: RouteContext) {
  const authError = await requireAdmin(req);
  if (authError) return authError;

  try {
    const { id } = await context.params;
    if (!ObjectId.isValid(id)) {
      return buildError("VALIDATION", "Invalid user id", 400);
    }

    const db = await connectDB(req);
    const user = await db.collection("users").findOne({ _id: new ObjectId(id) });
    if (!user) {
      return buildError("NOT_FOUND", "User not found", 404);
    }

    const orderCount = await db.collection("orders").countDocuments({
      userId: id,
      isDeleted: { $ne: true },
    });

    return NextResponse.json({
      user: normalizeUserForResponse(user as never, { orderCount }),
    });
  } catch (error) {
    console.error("[admin/users/:id] GET error:", error);
    return buildError("INTERNAL", "Failed to fetch user", 500);
  }
}

export async function PUT(req: Request, context: RouteContext) {
  const authError = await requireAdmin(req);
  if (authError) return authError;

  try {
    const { id } = await context.params;
    if (!ObjectId.isValid(id)) {
      return buildError("VALIDATION", "Invalid user id", 400);
    }

    const body = await req.json();
    const validation = validateUserUpdateInput(body);
    if (!validation.valid) {
      return buildError("VALIDATION", validation.message ?? "Invalid input", 400);
    }

    const db = await connectDB(req);
    const existing = await db.collection("users").findOne({ _id: new ObjectId(id) });
    if (!existing) {
      return buildError("NOT_FOUND", "User not found", 404);
    }

    const patch = { ...validation.patch! };
    const wasAdmin = resolveIsAdmin(existing as never);
    const willBeAdmin =
      patch.isAdminUser !== undefined ? patch.isAdminUser : wasAdmin;

    if (wasAdmin && !willBeAdmin) {
      const adminCount = await countAdminUsers(db);
      if (adminCount <= 1) {
        return buildError(
          "VALIDATION",
          "Cannot remove the last admin user",
          400,
        );
      }
    }

    const updateData: Record<string, unknown> = {};
    if (patch.name !== undefined) updateData.name = patch.name;
    if (patch.khataUrl !== undefined) updateData.khataUrl = patch.khataUrl;
    if (patch.isAdminUser !== undefined) {
      updateData.isAdminUser = patch.isAdminUser;
    }
    if (patch.isDriverUser !== undefined) {
      updateData.isDriverUser = patch.isDriverUser;
      if (patch.isDriverUser) {
        updateData.driverId = id;
      }
    }
    if (patch.password) {
      updateData.password = await hashPassword(patch.password);
    }

    await db
      .collection("users")
      .updateOne({ _id: new ObjectId(id) }, { $set: updateData });

    const updated = await db.collection("users").findOne({ _id: new ObjectId(id) });
    const orderCount = await db.collection("orders").countDocuments({
      userId: id,
      isDeleted: { $ne: true },
    });

    return NextResponse.json({
      user: normalizeUserForResponse(updated as never, { orderCount }),
    });
  } catch (error) {
    console.error("[admin/users/:id] PUT error:", error);
    return buildError("INTERNAL", "Failed to update user", 500);
  }
}

export async function DELETE(req: Request, context: RouteContext) {
  const authError = await requireAdmin(req);
  if (authError) return authError;

  let session: ClientSession | undefined;

  try {
    const { id } = await context.params;
    if (!ObjectId.isValid(id)) {
      return buildError("VALIDATION", "Invalid user id", 400);
    }

    const requestUserId = await getRequestUserId(req);
    if (requestUserId === id) {
      return buildError("VALIDATION", "You cannot delete your own account", 400);
    }

    const db = await connectDB(req);
    const user = await db.collection("users").findOne({ _id: new ObjectId(id) });
    if (!user) {
      return buildError("NOT_FOUND", "User not found", 404);
    }

    if (resolveIsAdmin(user as never)) {
      const adminCount = await countAdminUsers(db);
      if (adminCount <= 1) {
        return buildError(
          "VALIDATION",
          "Cannot delete the last admin user",
          400,
        );
      }
    }

    const client = await getClient();
    session = await startTransaction(client);
    const userObjectId = new ObjectId(id);
    const userIdStr = id;

    await db
      .collection("carts")
      .deleteOne({ userId: userObjectId }, { session });
    await db
      .collection("searchHistory")
      .deleteOne({ userId: userIdStr }, { session });
    await db
      .collection("userAddresses")
      .deleteMany({ userId: userIdStr }, { session });
    await db
      .collection("orders")
      .deleteMany({ userId: userIdStr }, { session });
    await db
      .collection("pushTokens")
      .deleteOne({ userId: userIdStr }, { session });

    const profileImage = (user as { profileImage?: { imageUrl?: string } | string })
      .profileImage;
    if (profileImage) {
      const imageRef =
        typeof profileImage === "string"
          ? profileImage
          : profileImage?.imageUrl;
      if (imageRef) {
        await deleteImage(imageRef);
      }
    }

    await db
      .collection("users")
      .deleteOne({ _id: userObjectId }, { session });

    await commitTransaction(session);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[admin/users/:id] DELETE error:", error);
    if (session) await abortTransaction(session);
    return buildError("INTERNAL", "Failed to delete user", 500);
  }
}
