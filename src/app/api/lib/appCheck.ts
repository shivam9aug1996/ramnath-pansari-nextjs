import { NextResponse } from "next/server";
import { verifyAppCheckToken } from "@/app/api/lib/appCheckVerify";
import { maskToken } from "@/app/api/lib/logger";

export const APP_CHECK_HEADER = "x-firebase-appcheck";

export type AppCheckMode = "off" | "monitor" | "enforce";

export function getAppCheckMode(): AppCheckMode {
  const raw = (process.env.APP_CHECK_MODE || "monitor").trim().toLowerCase();
  if (raw === "off" || raw === "enforce" || raw === "monitor") return raw;
  return "monitor";
}

function requestPath(req: Request): string {
  try {
    return new URL(req.url).pathname;
  } catch {
    return "";
  }
}

/** Always log (incl. production) so Android App Check token presence is visible. */
function appCheckLog(
  level: "info" | "warn",
  message: string,
  meta: Record<string, unknown>,
) {
  const line = `[app-check] ${message}`;
  if (level === "warn") {
    console.warn(line, meta);
  } else {
    console.log(line, meta);
  }
}

function clientHints(req: Request) {
  const ua = (req.headers.get("user-agent") || "").trim();
  const origin = (req.headers.get("origin") || "").trim();
  const uaLower = ua.toLowerCase();
  let platform: "android" | "ios" | "web" | "unknown" = "unknown";
  if (uaLower.includes("android")) platform = "android";
  else if (
    uaLower.includes("iphone") ||
    uaLower.includes("ipad") ||
    uaLower.includes("ios")
  ) {
    platform = "ios";
  } else if (
    uaLower.includes("mozilla") ||
    uaLower.includes("chrome") ||
    uaLower.includes("safari")
  ) {
    platform = "web";
  }

  return {
    platform,
    userAgent: ua ? ua.slice(0, 120) : null,
    origin: origin || null,
    method: req.method,
    path: requestPath(req),
  };
}

/** Browser clients (Expo web / Next admin) — no native App Attest / Play Integrity. */
function isBrowserClientRequest(req: Request): boolean {
  const origin = (req.headers.get("origin") || "").toLowerCase();
  const referer = (req.headers.get("referer") || "").toLowerCase();
  const combined = `${origin} ${referer}`;

  const browserOrigins = [
    "localhost:3000",
    "127.0.0.1:3000",
    "localhost:8081",
    "127.0.0.1:8081",
    "localhost:19006",
    "127.0.0.1:19006",
    "ramnath-pansari.vercel.app",
    "10.150.236.125:3000",
    "10.150.236.125:8081",
    "10.150.236.125:19006",
  ];

  if (browserOrigins.some((host) => combined.includes(host))) {
    return true;
  }

  // Same-origin Next admin pages sometimes omit Origin
  if (referer.includes("/admin")) {
    return true;
  }

  return false;
}

export type AppCheckResult =
  | { status: "skipped"; reason: string }
  | { status: "missing" }
  | { status: "ok"; appId?: string; exp?: number; expiresInSec?: number }
  | { status: "invalid"; error: unknown };

/**
 * Verify `X-Firebase-AppCheck` when present / required.
 * Does not throw — soft-fail unless mode is enforce.
 */
export async function evaluateAppCheck(req: Request): Promise<AppCheckResult> {
  const mode = getAppCheckMode();
  if (mode === "off") {
    return { status: "skipped", reason: "mode_off" };
  }

  if (isBrowserClientRequest(req)) {
    return { status: "skipped", reason: "browser_client" };
  }

  const token = req.headers.get(APP_CHECK_HEADER)?.trim() || "";
  if (!token) {
    return { status: "missing" };
  }

  try {
    const verified = await verifyAppCheckToken(token);
    if (!verified) {
      return { status: "invalid", error: "verify_failed" };
    }
    return {
      status: "ok",
      appId: verified.appId,
      exp: verified.exp,
      expiresInSec: verified.expiresInSec,
    };
  } catch (error) {
    return { status: "invalid", error };
  }
}

/**
 * Monitor by default (log only). Enforce returns 401 when token missing/invalid
 * for non-web clients.
 */
export async function requireAppCheck(req: Request): Promise<NextResponse | ""> {
  const mode = getAppCheckMode();
  const hints = clientHints(req);
  const rawHeader = req.headers.get(APP_CHECK_HEADER);
  const hasHeader = Boolean(rawHeader?.trim());

  // Always emit a presence line first so Android → backend token flow is easy to grep.
  appCheckLog("info", "request", {
    ...hints,
    mode,
    hasAppCheckHeader: hasHeader,
    tokenPreview: rawHeader,
    tokenLength: rawHeader?.trim()?.length ?? 0,
  });

  const result = await evaluateAppCheck(req);

  if (result.status === "ok") {
    appCheckLog("info", "ok — token accepted from client", {
      ...hints,
      mode,
      appId: result.appId,
      expiresInSec: result.expiresInSec,
      exp: result.exp,
      tokenPreview: rawHeader,
    });
    return "";
  }

  if (result.status === "skipped") {
    appCheckLog("info", "skipped", {
      ...hints,
      mode,
      reason: result.reason,
      hasAppCheckHeader: hasHeader,
      tokenPreview: rawHeader,
    });
    return "";
  }

  if (result.status === "missing") {
    appCheckLog("warn", "MISSING — no X-Firebase-AppCheck from client", {
      ...hints,
      mode,
    });
  } else {
    appCheckLog("warn", "INVALID — header present but verify failed", {
      ...hints,
      mode,
      tokenPreview: rawHeader,
      tokenLength: rawHeader?.trim()?.length ?? 0,
      error:
        result.error instanceof Error
          ? result.error.message
          : String(result.error),
    });
  }

  if (mode !== "enforce") {
    return "";
  }

  return NextResponse.json(
    {
      success: false,
      message:
        result.status === "missing"
          ? "App Check token required"
          : "App Check token invalid",
    },
    { status: 401 },
  );
}
