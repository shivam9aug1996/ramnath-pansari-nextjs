import { NextResponse } from "next/server";
import { connectDB } from "@/app/api/lib/dbconnection";
import { requireAdmin } from "@/app/api/admin/requireAdmin";
import { DRIVER_MOBILE_FALLBACK } from "@/app/api/admin/users/userUtils";

function buildError(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export async function GET(req: Request) {
  const authError = await requireAdmin(req);
  if (authError) return authError;

  try {
    const db = await connectDB(req);
    if (!db) {
      return buildError("INTERNAL", "Database connection failed", 500);
    }

    const driversRaw = await db
      .collection("users")
      .find({
        $or: [{ isDriverUser: true }, { mobileNumber: DRIVER_MOBILE_FALLBACK }],
      })
      .sort({ name: 1, mobileNumber: 1 })
      .toArray();

    const drivers = driversRaw.map((user) => ({
      _id: user._id.toString(),
      driverId:
        user.driverId != null && String(user.driverId).trim()
          ? String(user.driverId)
          : user._id.toString(),
      name: user.name ? String(user.name) : "Driver",
      mobileNumber: String(user.mobileNumber ?? ""),
    }));

    return NextResponse.json({ drivers }, { status: 200 });
  } catch (error) {
    console.error("[admin/drivers] GET error:", error);
    return buildError("INTERNAL", "Failed to list drivers", 500);
  }
}
