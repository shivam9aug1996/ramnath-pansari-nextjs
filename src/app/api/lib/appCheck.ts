import { NextResponse } from "next/server";
import { verifyAppCheckToken } from "@/app/api/lib/appCheckVerify";
import { log, logWarn, maskToken } from "@/app/api/lib/logger";

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
  const result = await evaluateAppCheck(req);

  if (result.status === "ok") {
    log("[app-check] ok", {
      appId: result.appId,
      expiresInSec: result.expiresInSec,
      exp: result.exp,
      mode,
    });
    return "";
  }

  if (result.status === "skipped") {
    log("[app-check] skipped", { reason: result.reason, mode });
    return "";
  }

  if (result.status === "missing") {
    logWarn("[app-check] missing header", {
      mode,
      path: requestPath(req),
    });
  } else {
    logWarn("[app-check] invalid token", {
      mode,
      path: requestPath(req),
      token: maskToken(req.headers.get(APP_CHECK_HEADER)),
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
