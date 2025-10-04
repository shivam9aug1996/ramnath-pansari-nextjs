import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { checkRateLimitForAPI } from "./json";
import jwt from "jsonwebtoken";

export async function middleware(request: NextRequest) {
  let userToken = request.cookies.get("ramnath_pansari_user_token")?.value;
  const authorization = request.headers.get("authorization");
  // console.log(request);
  let fp = request.headers.get("user-fingerprint");
  const currentPath = request.nextUrl.pathname;
  // if (currentPath === "/whatsapp-script.js") {
  //   return NextResponse.next();
  // }
  // console.log("6543edfghjyt543456", userToken, authorization);
  userToken = authorization?.split(" ")[1];
  // const decoded = await jwt.verify(userToken, "secretkey");
  // console.log("decoded8765434567890", decoded);
  console.log("liuy654ertyui987654567890", currentPath,userToken);

  if (!userToken) {
    // if(currentPath.startsWith("/admin")) {
    //   console.log("admin authenticated");
    //   return NextResponse.next();
    // }
    //return NextResponse.next();
    // console.log("876543456789", userToken, authorization);

    // if (currentPath.startsWith("/dashboard")) {
    //   let message = "token not exists";
    //   // User is not authenticated and trying to access a dashboard route, redirect to login
    //   return NextResponse.redirect(
    //     new URL(`/login?message=${encodeURIComponent(message)}`, request.url)
    //   );
    // }
    if (currentPath.startsWith("/api/driver")) {
      return NextResponse.next();
    }
    if (currentPath.startsWith("/api/task")) {
      return NextResponse.next();
    }
    if (!currentPath.startsWith("/api/auth")) {
      return new NextResponse(
        JSON.stringify({ success: false, message: "Authentication failed" }),
        { status: 401 }
      );
    }
    if(currentPath.includes("/addressMap")) {
      return new NextResponse(
        JSON.stringify({ success: false, message: "Authentication failed" }),
        { status: 401 }
      );
    }
   
    // else if (currentPath.includes("api/auth/signup")) {
    //   if (!fp) {
    //     return new NextResponse(
    //       JSON.stringify({ error: "Fingerprint header is needed" }),
    //       { status: 400 }
    //     );
    //   }
    //   if (checkRateLimitForAPI(fp, 2)) {
    //     return new NextResponse(
    //       JSON.stringify({ error: "Rate limit exceeded, wait for 60 seconds" }),
    //       { status: 429 }
    //     );
    //   } else {
    //     return NextResponse.next();
    //   }
    // }
    else {
      // User is not authenticated, allow access to other pages
      return NextResponse.next();
    }
  }
  else if(currentPath.includes("/addressMap")) {
    console.log("addressMap authenticated");
    return NextResponse.next();
  }else if(currentPath.includes("/admin")) {
    console.log("admin authenticated");
    return NextResponse.next();
  }
  // else if (
  //   currentPath === "/login" ||
  //   currentPath === "/signup" ||
  //   currentPath === "/" ||
  //   currentPath === "/dashboard"
  // ) {
  //   return NextResponse.redirect(new URL("/dashboard/customers", request.url));
  // } else {
  //   return NextResponse.next();
  // }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/:path*", "/addressMap/:path*", "/admin/:path*"],
};
