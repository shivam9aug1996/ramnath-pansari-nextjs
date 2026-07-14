import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getTokenFromAuthorizationHeader } from "./app/api/lib/authToken";
import { listMiddlewarePolicies } from "./app/api/lib/rateLimitPolicies";
import { consumeMemoryRateLimit } from "./app/api/lib/rateLimitMemory";

const ALLOWED_ORIGINS = new Set([
  "http://localhost:8081",
  "http://localhost:19006",
  "http://127.0.0.1:8081",
  "http://127.0.0.1:19006",
  "https://ramnath-pansari.vercel.app",
  "http://localhost:3000",
  // add your LAN Expo web origin if you open the app by IP, e.g.:
  // "http://10.150.228.133:8081",
]);

const PUBLIC_API_PREFIXES = [
  "/api/auth",
  "/api/task",
];

// Public GET routes (no token required in middleware)
const PUBLIC_GET_PATHS = new Set([
  "/api/category",
  "/api/carousel",
  "/api/offers",
  "/api/store-config",
  "/api/delivery-settings",
]);

function isAllowedOrigin(origin: string | null): origin is string {
  return Boolean(origin && ALLOWED_ORIGINS.has(origin));
}

function applyCorsHeaders(response: NextResponse, origin: string | null) {
  if (!isAllowedOrigin(origin)) {
    return response;
  }

  response.headers.set("Access-Control-Allow-Origin", origin);
  response.headers.set("Access-Control-Allow-Credentials", "true");
  response.headers.set(
    "Access-Control-Allow-Headers",
    "authorization, content-type, x-requested-with",
  );
  response.headers.set(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  );
  response.headers.set("Vary", "Origin");

  return response;
}

function corsPreflightResponse(request: NextRequest) {
  const origin = request.headers.get("origin");
  const response = new NextResponse(null, { status: 204 });
  response.headers.set("Access-Control-Max-Age", "86400");
  return applyCorsHeaders(response, origin);
}

function isPublicApiRequest(request: NextRequest, path: string) {
  if (PUBLIC_API_PREFIXES.some((prefix) => path.startsWith(prefix))) {
    return true;
  }

  if (request.method === "GET" && PUBLIC_GET_PATHS.has(path)) {
    return true;
  }

  return false;
}

function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  return "unknown";
}

function applyMiddlewareRateLimits(
  request: NextRequest,
  pathname: string,
  origin: string | null,
): NextResponse | null {
  const ip = getClientIp(request);
  const policies = listMiddlewarePolicies();

  for (const policy of policies) {
    if (!policy.matchPath?.(pathname)) continue;

    const result = consumeMemoryRateLimit(policy, ip);
    if (result.allowed) continue;

    const retryAfterSec = Math.max(
      Math.ceil((result.resetAt - Date.now()) / 1000),
      1,
    );
    return applyCorsHeaders(
      new NextResponse(
        JSON.stringify({
          error: { code: "429", message: "Too Many Requests" },
        }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "Retry-After": String(retryAfterSec),
            "X-RateLimit-Limit": String(result.limit),
            "X-RateLimit-Remaining": String(result.remaining),
            "X-RateLimit-Reset": String(Math.ceil(result.resetAt / 1000)),
            "X-RateLimit-Policy": policy.id,
          },
        },
      ),
      origin,
    );
  }

  return null;
}

export async function middleware(request: NextRequest) {
  const origin = request.headers.get("origin");
  const currentPath = request.nextUrl.pathname;

  // Browser preflight — must succeed before real GET/POST runs
  if (request.method === "OPTIONS") {
    return corsPreflightResponse(request);
  }

  const rateLimited = applyMiddlewareRateLimits(request, currentPath, origin);
  if (rateLimited) {
    return rateLimited;
  }

  const authorization = request.headers.get("authorization");
  const bearerToken = getTokenFromAuthorizationHeader(authorization);
  const cookieToken = request.cookies.get("ramnath_pansari_user_token")?.value;
  const userToken = bearerToken || cookieToken || "";

  if (!userToken) {
    if (isPublicApiRequest(request, currentPath)) {
      return applyCorsHeaders(NextResponse.next(), origin);
    }

    if (currentPath.includes("/addressMap")) {
      return applyCorsHeaders(
        new NextResponse(
          JSON.stringify({ success: false, message: "Authentication failed" }),
          { status: 401, headers: { "Content-Type": "application/json" } },
        ),
        origin,
      );
    }

    return applyCorsHeaders(
      new NextResponse(
        JSON.stringify({ success: false, message: "Authentication failed" }),
        { status: 401, headers: { "Content-Type": "application/json" } },
      ),
      origin,
    );
  }

  return applyCorsHeaders(NextResponse.next(), origin);
}

export const config = {
  matcher: ["/api/:path*", "/addressMap/:path*", "/admin/:path*"],
};
