import jwt from "jsonwebtoken";
import { NextRequest, NextResponse } from "next/server";
import { deleteCookies } from "./app/actions";
import { secretKey } from "./app/api/lib/keys";
import { log, logWarn } from "./app/api/lib/logger";

type RateLimitEntry = { count: number; timestamp: number };

const requestCounts: Record<string, RateLimitEntry> = {};

export async function verifyToken(
  token: string,
  req: NextRequest,
): Promise<boolean> {
  try {
    const decoded = jwt.verify(token, secretKey!);
    void req?.headers?.get("user-agent");
    void req.headers.get("user-fingerprint");
    return Boolean(decoded);
  } catch {
    return false;
  }
}

export const isTokenVerified = async (
  req: NextRequest,
): Promise<NextResponse | ""> => {
  const token = req.headers.get("authorization")?.split(" ")[1];
  log("auth check", req?.url);
  if (token) {
    const verified = await verifyToken(token, req);
    if (!verified) {
      deleteCookies();
      return NextResponse.json(
        { success: false, message: "Authentication failed" },
        { status: 401 },
      );
    }
    return "";
  }

  return req?.url?.includes("api/auth")
    ? ""
    : NextResponse.json(
        { success: false, message: "Authentication failed" },
        { status: 401 },
      );
};

export const checkRateLimitForAPI = (
  fp: string | null = null,
  maxReq = 10,
  timeMs = 60000,
): boolean => {
  log("Checking rate limit for IP:", fp);
  const currentTime = Date.now();
  const intervalMs = timeMs || 60000;
  const maxRequests = maxReq || 10;

  if (fp && requestCounts[fp]) {
    if (
      requestCounts[fp].count >= maxRequests &&
      currentTime - requestCounts[fp].timestamp < intervalMs
    ) {
      logWarn("Rate limit exceeded for IP:", fp);
      return true;
    }

    if (currentTime - requestCounts[fp].timestamp > intervalMs) {
      requestCounts[fp] = { count: 1, timestamp: currentTime };
    } else {
      requestCounts[fp].count++;
    }
  } else if (fp) {
    requestCounts[fp] = { count: 1, timestamp: currentTime };
  }

  return false;
};
