import { NextRequest, NextResponse } from "next/server";
import { verifyJwt } from "./app/api/lib/jwt";
import { getTokenCandidatesFromRequest } from "./app/api/lib/authToken";
import { logAuth, log, logWarn, maskToken } from "./app/api/lib/logger";

type RateLimitEntry = { count: number; timestamp: number };

const requestCounts: Record<string, RateLimitEntry> = {};

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

export const isTokenVerified = async (
  req: NextRequest,
): Promise<NextResponse | ""> => {
  const path = new URL(req.url).pathname;
  const candidates = getTokenCandidatesFromRequest(req);

  logAuth("isTokenVerified", {
    path,
    candidateCount: candidates.length,
    sources: candidates.map((c) => c.source),
    tokenPreviews: candidates.map((c) => maskToken(c.token)),
    hasAuthHeader: Boolean(req.headers.get("authorization")),
  });

  for (const { token, source } of candidates) {
    const verified = await verifyToken(token, req);
    if (verified) {
      if (source === "cookie" && candidates[0]?.source === "bearer") {
        logAuth("isTokenVerified:fallback", {
          path,
          reason: "stale-bearer-used-cookie",
        });
      }
      logAuth("isTokenVerified:allow", { path, tokenSource: source });
      return "";
    }

    logAuth("isTokenVerified:skip", {
      path,
      source,
      reason: "invalid-token",
      tokenPreview: maskToken(token),
    });
  }

  if (candidates.length > 0) {
    logAuth("isTokenVerified:deny", { path, reason: "invalid-token" });
    return NextResponse.json(
      { success: false, message: "Authentication failed" },
      { status: 401 },
    );
  }

  if (req?.url?.includes("api/auth")) {
    logAuth("isTokenVerified:allow", { path, reason: "auth-route" });
    return "";
  }

  logAuth("isTokenVerified:deny", { path, reason: "missing-token" });
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
