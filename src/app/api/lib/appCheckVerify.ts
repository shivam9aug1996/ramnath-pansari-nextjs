import { createRemoteJWKSet, jwtVerify } from "jose";
import { logWarn } from "@/app/api/lib/logger";

const APP_CHECK_ISSUER_HOST = "https://firebaseappcheck.googleapis.com";
const APP_CHECK_JWKS_URL = `${APP_CHECK_ISSUER_HOST}/v1/jwks`;

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

function getJwks() {
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(APP_CHECK_JWKS_URL));
  }
  return jwks;
}

function getProjectIds() {
  const projectId =
    process.env.FIREBASE_PROJECT_ID?.trim() || "ramnath-pansari-6aea0";
  const projectNumber =
    process.env.FIREBASE_PROJECT_NUMBER?.trim() || "930671228267";
  return { projectId, projectNumber };
}

export type VerifiedAppCheck = {
  appId?: string;
  subject?: string;
  exp?: number;
  expiresInSec?: number;
};

function toVerified(payload: {
  sub?: unknown;
  exp?: unknown;
}): VerifiedAppCheck {
  const exp = typeof payload.exp === "number" ? payload.exp : undefined;
  const expiresInSec =
    exp != null ? Math.max(0, exp - Math.floor(Date.now() / 1000)) : undefined;

  return {
    appId: typeof payload.sub === "string" ? payload.sub : undefined,
    subject: typeof payload.sub === "string" ? payload.sub : undefined,
    exp,
    expiresInSec,
  };
}

/**
 * Verify an App Check JWT with Google's public JWKS (no firebase-admin).
 * See: https://firebase.google.com/docs/app-check/custom-resource-backend
 */
export async function verifyAppCheckToken(
  token: string,
): Promise<VerifiedAppCheck | null> {
  const { projectId, projectNumber } = getProjectIds();

  try {
    const { payload } = await jwtVerify(token, getJwks(), {
      algorithms: ["RS256"],
      audience: [`projects/${projectId}`, `projects/${projectNumber}`],
      issuer: `${APP_CHECK_ISSUER_HOST}/${projectNumber}`,
    });

    return toVerified(payload);
  } catch (error) {
    // Retry without strict issuer — some environments only match audience.
    try {
      const { payload } = await jwtVerify(token, getJwks(), {
        algorithms: ["RS256"],
        audience: [`projects/${projectId}`, `projects/${projectNumber}`],
      });
      return toVerified(payload);
    } catch (retryError) {
      logWarn(
        "[app-check] jose verify failed",
        retryError instanceof Error ? retryError.message : retryError,
      );
      return null;
    }
  }
}
