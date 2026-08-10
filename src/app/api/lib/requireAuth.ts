import { NextRequest, NextResponse } from "next/server";
import { verifyJwt } from "@/app/api/lib/jwt";
import { getTokenCandidatesFromRequest } from "@/app/api/lib/authToken";
import { requireAppCheck } from "@/app/api/lib/appCheck";

export type AuthUser = {
  id: string;
  mobileNumber?: string;
  isGuestUser?: boolean;
  isDriverUser?: boolean;
  isAdminUser?: boolean;
};

async function getVerifiedUser(token: string): Promise<AuthUser | null> {
  const payload = await verifyJwt(token);
  if (!payload || typeof payload.id !== "string" || !payload.id) {
    return null;
  }
  return {
    id: payload.id,
    mobileNumber:
      typeof payload.mobileNumber === "string"
        ? payload.mobileNumber
        : undefined,
    isGuestUser: Boolean(payload.isGuestUser),
    isDriverUser: Boolean(payload.isDriverUser),
    isAdminUser: Boolean(payload.isAdminUser),
  };
}

/**
 * Verifies JWT and returns the authenticated user.
 * Prefer this over isTokenVerified when the handler needs identity binding.
 */
export async function requireAuthUser(
  req: Request,
): Promise<{ user: AuthUser } | NextResponse> {
  const appCheckResponse = await requireAppCheck(req);
  if (appCheckResponse) {
    return appCheckResponse;
  }

  const candidates = getTokenCandidatesFromRequest(req);
  for (const { token } of candidates) {
    if (token === "guest_token") {
      return NextResponse.json(
        { success: false, message: "Authentication required" },
        { status: 401 },
      );
    }
    const user = await getVerifiedUser(token);
    if (user) {
      return { user };
    }
  }

  return NextResponse.json(
    { success: false, message: "Authentication failed" },
    { status: 401 },
  );
}

/** Reject when client userId does not match JWT subject. */
export function assertSameUser(
  authUserId: string,
  requestedUserId: string | null | undefined,
): NextResponse | null {
  if (!requestedUserId || String(requestedUserId) !== String(authUserId)) {
    return NextResponse.json(
      { success: false, message: "Forbidden" },
      { status: 403 },
    );
  }
  return null;
}

/** Convenience: auth + same-user check; returns auth user id on success. */
export async function requireSameUser(
  req: Request,
  requestedUserId: string | null | undefined,
): Promise<{ userId: string } | NextResponse> {
  const auth = await requireAuthUser(req);
  if (auth instanceof NextResponse) return auth;
  const mismatch = assertSameUser(auth.user.id, requestedUserId);
  if (mismatch) return mismatch;
  return { userId: auth.user.id };
}

export async function getOptionalAuthUser(
  req: NextRequest,
): Promise<AuthUser | null> {
  const candidates = getTokenCandidatesFromRequest(req);
  for (const { token } of candidates) {
    if (token === "guest_token") continue;
    const user = await getVerifiedUser(token);
    if (user) return user;
  }
  return null;
}
