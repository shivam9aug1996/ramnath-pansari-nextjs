// import { NextResponse } from "next/server";
// import type { NextRequest } from "next/server";
// import { getTokenFromAuthorizationHeader } from "./app/api/lib/authToken";

// export async function middleware(request: NextRequest) {
//   const authorization = request.headers.get("authorization");
//   const currentPath = request.nextUrl.pathname;
//   const bearerToken = getTokenFromAuthorizationHeader(authorization);
//   const cookieToken = request.cookies.get("ramnath_pansari_user_token")?.value;
//   const userToken = bearerToken || cookieToken || "";

//   if (!userToken) {
//     if (currentPath.startsWith("/api/task")) {
//       return NextResponse.next();
//     }
//     if (!currentPath.startsWith("/api/auth")) {
//       return new NextResponse(
//         JSON.stringify({ success: false, message: "Authentication failed" }),
//         { status: 401 },
//       );
//     }
//     if (currentPath.includes("/addressMap")) {
//       return new NextResponse(
//         JSON.stringify({ success: false, message: "Authentication failed" }),
//         { status: 401 },
//       );
//     } else {
//       return NextResponse.next();
//     }
//   }

//   return NextResponse.next();
// }

// export const config = {
//   matcher: ["/api/:path*", "/addressMap/:path*", "/admin/:path*"],
// };



import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getTokenFromAuthorizationHeader } from "./app/api/lib/authToken";

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

export async function middleware(request: NextRequest) {
  const origin = request.headers.get("origin");
  const currentPath = request.nextUrl.pathname;

  // Browser preflight — must succeed before real GET/POST runs
  if (request.method === "OPTIONS") {
    return corsPreflightResponse(request);
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