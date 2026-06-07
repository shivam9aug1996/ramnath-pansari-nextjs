import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { log } from "./app/api/lib/logger";

export async function middleware(request: NextRequest) {
  let userToken = request.cookies.get("ramnath_pansari_user_token")?.value;
  const authorization = request.headers.get("authorization");

  const currentPath = request.nextUrl.pathname;

  userToken = authorization?.split(" ")[1];

  log("middleware", currentPath);

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
  } else if (currentPath.includes("/addressMap")) {
    return NextResponse.next();
  } else if (currentPath.includes("/admin")) {
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/:path*", "/addressMap/:path*", "/admin/:path*"],
};
