import { cookies } from "next/headers";

export type TokenCandidate = {
  token: string;
  source: "bearer" | "cookie";
};

export function getTokenFromAuthorizationHeader(
  authorization: string | null,
): string {
  if (!authorization) return "";
  if (authorization.startsWith("Bearer ")) {
    return authorization.slice(7).trim();
  }
  return authorization.split(" ")[1]?.trim() ?? authorization.trim();
}

function getCookieToken(): string {
  try {
    return cookies().get("ramnath_pansari_user_token")?.value ?? "";
  } catch {
    return "";
  }
}

/** Bearer first, then cookie if different (handles stale Authorization after login). */
export function getTokenCandidatesFromRequest(req: Request): TokenCandidate[] {
  const bearer = getTokenFromAuthorizationHeader(
    req.headers.get("authorization"),
  );
  const cookie = getCookieToken();
  const candidates: TokenCandidate[] = [];

  if (bearer) candidates.push({ token: bearer, source: "bearer" });
  if (cookie && cookie !== bearer) {
    candidates.push({ token: cookie, source: "cookie" });
  }

  return candidates;
}

export function getTokenFromRequest(req: Request): string {
  const candidates = getTokenCandidatesFromRequest(req);
  return candidates[0]?.token ?? "";
}

export function getTokenFromMiddlewareRequest(
  authorization: string | null,
  cookieToken?: string,
): { token: string; source: "bearer" | "cookie" | "none" } {
  const bearerToken = getTokenFromAuthorizationHeader(authorization);
  if (bearerToken) {
    return { token: bearerToken, source: "bearer" };
  }
  if (cookieToken) {
    return { token: cookieToken, source: "cookie" };
  }
  return { token: "", source: "none" };
}
