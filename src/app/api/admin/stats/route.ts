import { NextResponse } from "next/server";
import { connectDB } from "@/app/api/lib/dbconnection";
import { requireAdmin } from "@/app/api/admin/requireAdmin";
import {
  CategoryNode,
  countCategoryStats,
} from "@/app/api/admin/categories/categoryUtils";
import {
  ADMIN_MOBILE_FALLBACK,
  GUEST_MOBILE,
} from "@/app/api/admin/users/userUtils";

export async function GET(req: Request) {
  const authError = await requireAdmin(req);
  if (authError) return authError;

  try {
    const db = await connectDB(req);
    if (!db) {
      return NextResponse.json(
        { error: { code: "INTERNAL", message: "Database connection failed" } },
        { status: 500 },
      );
    }

    const baseFilter = { isDeleted: { $ne: true } };
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const productFilter = { isDeleted: { $ne: true } };

    const [
      total,
      today,
      confirmed,
      outForDelivery,
      delivered,
      canceled,
      productTotal,
      productInStock,
      productOutOfStock,
      productPromoOnly,
      categoryRoots,
      userTotal,
      userAdmins,
      userCustomers,
      userGuests,
    ] = await Promise.all([
      db.collection("orders").countDocuments(baseFilter),
      db.collection("orders").countDocuments({
        ...baseFilter,
        createdAt: { $gte: startOfDay },
      }),
      db.collection("orders").countDocuments({
        ...baseFilter,
        orderStatus: "confirmed",
      }),
      db.collection("orders").countDocuments({
        ...baseFilter,
        orderStatus: "out_for_delivery",
      }),
      db.collection("orders").countDocuments({
        ...baseFilter,
        orderStatus: "delivered",
      }),
      db.collection("orders").countDocuments({
        ...baseFilter,
        orderStatus: "canceled",
      }),
      db.collection("products").countDocuments(productFilter),
      db.collection("products").countDocuments({
        ...productFilter,
        isOutOfStock: { $ne: true },
      }),
      db.collection("products").countDocuments({
        ...productFilter,
        isOutOfStock: true,
      }),
      db.collection("products").countDocuments({
        ...productFilter,
        promoOnly: true,
      }),
      db.collection("categories").find({}).toArray(),
      db.collection("users").countDocuments({}),
      db.collection("users").countDocuments({
        $or: [{ isAdminUser: true }, { mobileNumber: ADMIN_MOBILE_FALLBACK }],
      }),
      db.collection("users").countDocuments({
        isAdminUser: { $ne: true },
        mobileNumber: { $nin: [ADMIN_MOBILE_FALLBACK, GUEST_MOBILE] },
      }),
      db.collection("users").countDocuments({ mobileNumber: GUEST_MOBILE }),
    ]);

    const categoryStats = countCategoryStats(categoryRoots as CategoryNode[]);

    return NextResponse.json(
      {
        total,
        today,
        byStatus: {
          confirmed,
          out_for_delivery: outForDelivery,
          delivered,
          canceled,
        },
        products: {
          total: productTotal,
          inStock: productInStock,
          outOfStock: productOutOfStock,
          promoOnly: productPromoOnly,
        },
        categories: categoryStats,
        users: {
          total: userTotal,
          admins: userAdmins,
          customers: userCustomers,
          guests: userGuests,
        },
      },
      { status: 200 },
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json(
      { error: { code: "INTERNAL", message } },
      { status: 500 },
    );
  }
}
