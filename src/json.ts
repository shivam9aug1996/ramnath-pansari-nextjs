import { NextRequest, NextResponse } from "next/server";
import { verifyJwt } from "./app/api/lib/jwt";
import { getTokenCandidatesFromRequest } from "./app/api/lib/authToken";
import { requireAppCheck } from "./app/api/lib/appCheck";
import { log, logWarn } from "./app/api/lib/logger";

type RateLimitEntry = { count: number; timestamp: number };

const requestCounts: Record<string, RateLimitEntry> = {};


type AuthUser = {
  id: string;
  mobileNumber?: string;
  isGuestUser?: boolean;
  isDriverUser?: boolean;
  isAdminUser?: boolean;
};

async function getVerifiedUser(token: string): Promise<AuthUser | null> {
  const payload = await verifyJwt(token);
  if (!payload || typeof payload.id !== "string" || !payload.id) {
    return null;
  }
  return {
    id: payload.id,
    mobileNumber: typeof payload.mobileNumber === "string" ? payload.mobileNumber : undefined,
    isGuestUser: Boolean(payload.isGuestUser),
    isDriverUser: Boolean(payload.isDriverUser),
    isAdminUser: Boolean(payload.isAdminUser),
  };
}

export async function verifyToken(
  token: string,
  req: NextRequest,
): Promise<boolean> {
  try {
    const decoded = await verifyJwt(token);
    void req?.headers?.get("user-agent");
    void req.headers.get("user-fingerprint");
    return Boolean(decoded);
  } catch {
    return false;
  }
}

const GUEST_ALLOWED = [
  { method: "POST", path: "/api/app/sync-state" },
  { method: "GET", path: "/api/carousel" },
  { method: "GET", path: "/api/category" },
  { method: "GET", path: "/api/products" },
  { method: "GET", path: "/api/products/detail" },
  { method: "GET", path: "/api/search" },
  { method: "POST", path: "/api/save-push-token" },
  { method: "POST", path: "/api/generateGreeting" },
] as const;

const DRIVER_ALLOWED = [
  { method: "POST", path: "/api/logout" },
  { method: "POST", path: "/api/private" },
  { method: "GET", path: "/api/profile" },
  { method: "PATCH", path: "/api/profile" }, // drop if drivers shouldn't edit profile
  { method: "POST", path: "/api/save-push-token" },
] as const;

const ADMIN_ALLOWED = [
  { method: "POST", path: "/api/logout" },
  { method: "POST", path: "/api/private" },
  { method: "POST", path: "/api/save-push-token" },
  // add anything else the admin UI truly needs outside /api/admin
] as const;
function isAdminAllowed(req: NextRequest) {
  const path = req.nextUrl.pathname;
  const method = req.method.toUpperCase();
  if (path.startsWith("/api/admin")) return true;
  if (path.startsWith("/api/auth")) return true;
  // explicitly NOT /api/driver
  return ADMIN_ALLOWED.some((r) => r.method === method && r.path === path);
}

function isDriverAllowed(req: NextRequest) {
  const path = req.nextUrl.pathname;
  const method = req.method.toUpperCase();
  // All driver APIs
  if (path.startsWith("/api/driver")) return true;
  // Auth stays open via middleware / auth routes; keep explicit if needed
  if (path.startsWith("/api/auth")) return true;
  return DRIVER_ALLOWED.some((r) => r.method === method && r.path === path);
}

function isGuestAllowed(req: NextRequest) {
  const path = req.nextUrl.pathname; // better than req.url.includes
  const method = req.method.toUpperCase();
  return GUEST_ALLOWED.some((r) => r.method === method && r.path === path);
}

export const isTokenVerified = async (
  req: NextRequest,
): Promise<NextResponse | ""> => {
  const appCheckResponse = await requireAppCheck(req);
  if (appCheckResponse) {
    return appCheckResponse;
  }
  

  const candidates = getTokenCandidatesFromRequest(req);
  console.log("candidates", candidates);
  for (const { token } of candidates) {
    if(token === "guest_token" && isGuestAllowed(req)) {
      return "";
    }else if(token === "guest_token" && !isGuestAllowed(req)) {
      return NextResponse.json(
        { success: false, message: "Not allowed" },
        { status: 403 },
      );
    }
    const verified = await verifyToken(token, req);
    
    const user = await getVerifiedUser(token);
    if (user && verified) {
      if (user.isDriverUser && !isDriverAllowed(req)) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: "FORBIDDEN",
              message: "Driver accounts cannot access customer APIs",
            },
          },
          { status: 403 },
        );
      }
      if (user.isAdminUser && !isAdminAllowed(req)) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: "FORBIDDEN",
              message: "Admin accounts cannot access customer or driver APIs",
            },
          },
          { status: 403 },
        );
      }
      return "";
    }
  }

  if (candidates.length > 0) {
    return NextResponse.json(
      { success: false, message: "Authentication failed" },
      { status: 401 },
    );
  }

  if (req?.url?.includes("api/auth")) {
    return "";
  }

  return NextResponse.json(
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
