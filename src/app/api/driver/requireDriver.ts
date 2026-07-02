import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { connectDB } from "@/app/api/lib/dbconnection";
import { verifyJwt } from "@/app/api/lib/jwt";
import { getTokenCandidatesFromRequest } from "@/app/api/lib/authToken";
import type { UserDocument } from "@/app/api/admin/users/userUtils";
import { resolveIsDriver } from "@/app/api/admin/users/userUtils";

type AnyObject = { [key: string]: unknown };

function buildError(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export type DriverAuthContext = {
  db: Awaited<ReturnType<typeof connectDB>>;
  user: UserDocument;
  driverId: string;
};

export async function requireDriver(
  req: Request,
): Promise<{ error: NextResponse } | DriverAuthContext> {
  const candidates = getTokenCandidatesFromRequest(req);

  if (candidates.length === 0) {
    return { error: buildError("UNAUTHORIZED", "Missing token", 401) };
  }

  try {
    const db = await connectDB(req);
    if (!db) {
      return { error: buildError("INTERNAL", "Database connection failed", 500) };
    }

    for (const { token } of candidates) {
      const decoded = (await verifyJwt(token)) as AnyObject | null;
      if (!decoded?.id) continue;

      const user = (await db
        .collection("users")
        .findOne({ _id: new ObjectId(String(decoded.id)) })) as UserDocument | null;

      if (!user) continue;

      if (!resolveIsDriver(user)) {
        return { error: buildError("FORBIDDEN", "Driver access required", 403) };
      }

      const driverId =
        user.driverId != null && String(user.driverId).trim()
          ? String(user.driverId)
          : user._id?.toString() ?? "";

      if (!driverId) {
        return { error: buildError("FORBIDDEN", "Driver profile incomplete", 403) };
      }

      return { db, user, driverId };
    }

    return { error: buildError("UNAUTHORIZED", "User not found", 401) };
  } catch {
    return { error: buildError("UNAUTHORIZED", "Invalid or expired token", 401) };
  }
}
