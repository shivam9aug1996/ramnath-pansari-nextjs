import jwt from "jsonwebtoken";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { deleteCookies } from "./app/actions";
import { secretKey } from "./app/api/lib/keys";

var requestCounts = {};

export async function verifyToken(token, req) {
  try {
    const decoded = await jwt.verify(token, secretKey);
    let userAgentHeader = req?.headers?.get("user-agent");
    let userFingerprint = req.headers.get("user-fingerprint");
    if (
      decoded
      // decoded?.userAgentHeader === userAgentHeader &&
      // userAgentHeader &&
      // userFingerprint &&
      // decoded?.userFingerprint === userFingerprint
    ) {
      return true;
    } else {
      return false;
    }
  } catch (error) {
    return false;
  }
}

export const isTokenVerified = async (req) => {
  let token = cookies().get("bahi_khata_user_token")?.value;
  if (token) {
    let isTokenVerified = await verifyToken(token, req);
    if (!isTokenVerified) {
      deleteCookies();
      return false;
    } else {
      return true;
    }
  } else {
    return true;
  }
};

export const checkRateLimitForAPI = (
  fp = null,
  maxReq = 10,
  timeMs = 60000
) => {
  console.log("Checking rate limit for IP:", fp);
  const currentTime = Date.now();
  const intervalMs = timeMs || 60000; // 1 minute
  const maxRequests = maxReq || 10; // Maximum requests allowed within the interval
  // If IP exists in requestCounts, check the request count
  if (fp && requestCounts[fp]) {
    // If requests exceed the limit within the interval, return true (rate limit exceeded)
    if (
      requestCounts[fp].count >= maxRequests &&
      currentTime - requestCounts[fp].timestamp < intervalMs
    ) {
      console.log("Rate limit exceeded for IP:", fp);
      return true;
    }

    // If the interval has passed since the last request, reset the count
    if (currentTime - requestCounts[fp].timestamp > intervalMs) {
      requestCounts[fp] = { count: 1, timestamp: currentTime }; // Reset count for a new interval
    } else {
      requestCounts[fp].count++; // Increment the request count within the interval
    }
  } else {
    // If the IP is new or not found, initialize the count
    requestCounts[fp] = { count: 1, timestamp: currentTime };
  }

  return false; // Rate limit not exceeded
};
