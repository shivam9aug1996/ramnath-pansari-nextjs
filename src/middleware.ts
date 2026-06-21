import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getTokenFromAuthorizationHeader } from "./app/api/lib/authToken";
import { logAuth, maskToken } from "./app/api/lib/logger";

export async function middleware(request: NextRequest) {
  const authorization = request.headers.get("authorization");
  const currentPath = request.nextUrl.pathname;
  const bearerToken = getTokenFromAuthorizationHeader(authorization);
  const cookieToken = request.cookies.get("ramnath_pansari_user_token")?.value;
  const userToken = bearerToken || cookieToken || "";
  const tokenSource = bearerToken ? "bearer" : cookieToken ? "cookie" : "none";

  logAuth("middleware", {
    path: currentPath,
    tokenSource,
    hasToken: Boolean(userToken),
    tokenPreview: maskToken(userToken),
    bearerPreview: maskToken(bearerToken),
    cookiePreview: maskToken(cookieToken),
    tokensDiffer: Boolean(
      bearerToken && cookieToken && bearerToken !== cookieToken,
    ),
    hasAuthHeader: Boolean(authorization),
    hasCookie: Boolean(cookieToken),
  });

  if (!userToken) {
    if (currentPath.startsWith("/api/driver")) {
      logAuth("middleware:allow", { path: currentPath, reason: "driver-route" });
      return NextResponse.next();
    }
    if (currentPath.startsWith("/api/task")) {
      logAuth("middleware:allow", { path: currentPath, reason: "task-route" });
      return NextResponse.next();
    }
    if (!currentPath.startsWith("/api/auth")) {
      logAuth("middleware:deny", { path: currentPath, reason: "missing-token" });
      return new NextResponse(
        JSON.stringify({ success: false, message: "Authentication failed" }),
        { status: 401 },
      );
    }
    if (currentPath.includes("/addressMap")) {
      logAuth("middleware:deny", {
        path: currentPath,
        reason: "addressMap-missing-token",
      });
      return new NextResponse(
        JSON.stringify({ success: false, message: "Authentication failed" }),
        { status: 401 },
      );
    } else {
      logAuth("middleware:allow", { path: currentPath, reason: "auth-route" });
      return NextResponse.next();
    }
  }

  logAuth("middleware:allow", {
    path: currentPath,
    reason: "authenticated",
    tokenSource,
  });

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/:path*", "/addressMap/:path*", "/admin/:path*"],
};
