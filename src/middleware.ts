import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getTokenFromAuthorizationHeader } from "./app/api/lib/authToken";

export async function middleware(request: NextRequest) {
  const authorization = request.headers.get("authorization");
  const currentPath = request.nextUrl.pathname;
  const bearerToken = getTokenFromAuthorizationHeader(authorization);
  const cookieToken = request.cookies.get("ramnath_pansari_user_token")?.value;
  const userToken = bearerToken || cookieToken || "";

  if (!userToken) {
    if (currentPath.startsWith("/api/driver")) {
      return NextResponse.next();
    }
    if (currentPath.startsWith("/api/task")) {
      return NextResponse.next();
    }
    if (!currentPath.startsWith("/api/auth")) {
      return new NextResponse(
        JSON.stringify({ success: false, message: "Authentication failed" }),
        { status: 401 },
      );
    }
    if (currentPath.includes("/addressMap")) {
      return new NextResponse(
        JSON.stringify({ success: false, message: "Authentication failed" }),
        { status: 401 },
      );
    } else {
      return NextResponse.next();
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/:path*", "/addressMap/:path*", "/admin/:path*"],
};
