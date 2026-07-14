/**
 * Named rate-limit policies.
 * Add new entries here as you customize limits per surface (auth, admin, etc.).
 */

export type RateLimitPolicy = {
  id: string;
  description?: string;
  /** Fixed window length in ms */
  windowMs: number;
  /** Max requests per identity per window */
  max: number;
  /** Redis / memory key namespace */
  keyPrefix: string;
  /**
   * When set, Edge middleware auto-applies this policy to matching paths.
   * Leave unset for policies you only call manually from route handlers.
   */
  matchPath?: (pathname: string) => boolean;
  enabled?: boolean;
};

export const RATE_LIMIT_POLICIES = {
  /**
   * Rule 2 — general API (Hobby Vercel only allows one firewall RL rule;
   * auth stays on Vercel, everything else here).
   */
  apiGeneral: {
    id: "apiGeneral",
    description: "General API traffic — 100 req / 60s / IP",
    windowMs: 60_000,
    max: 100,
    keyPrefix: "rl:api:general",
    matchPath: (pathname: string) => {
      if (!pathname.startsWith("/api")) return false;
      // Owned by Vercel Firewall (Hobby single rate-limit rule)
      if (pathname.startsWith("/api/auth")) return false;
      if (pathname.startsWith("/api/logout")) return false;
      return true;
    },
    enabled: true,
  },

  /**
   * Example for later — enable + set matchPath or call enforceRateLimit in routes.
   *
   * authStrict: {
   *   id: "authStrict",
   *   description: "OTP / login — tight limit",
   *   windowMs: 60_000,
   *   max: 15,
   *   keyPrefix: "rl:auth",
   *   matchPath: (p) => p.startsWith("/api/auth") || p.startsWith("/api/logout"),
   *   enabled: false,
   * },
   */
} as const satisfies Record<string, RateLimitPolicy>;

export type RateLimitPolicyId = keyof typeof RATE_LIMIT_POLICIES;

export function getRateLimitPolicy(
  policyId: RateLimitPolicyId,
): RateLimitPolicy {
  return RATE_LIMIT_POLICIES[policyId];
}

export function listMiddlewarePolicies(): RateLimitPolicy[] {
  return (Object.values(RATE_LIMIT_POLICIES) as RateLimitPolicy[]).filter(
    (p) => p.enabled !== false && typeof p.matchPath === "function",
  );
}
