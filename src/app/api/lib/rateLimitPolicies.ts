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

  guestCreate: {
    id: "guestCreate",
    description: "Anonymous guest session create — 10 req / 60s / IP",
    windowMs: 60_000,
    max: 10,
    keyPrefix: "rl:auth:guest",
    enabled: true,
  },

  /** SMS OTP send — per IP (extra to per-mobile cooldown in smsOtpUtils). */
  smsOtpSendIp: {
    id: "smsOtpSendIp",
    description: "SMS OTP send — 10 req / hour / IP",
    windowMs: 60 * 60 * 1000,
    max: 10,
    keyPrefix: "rl:auth:sms-otp:send:ip",
    enabled: true,
  },

  /** SMS OTP send — per mobile (backs utils hourly cap). */
  smsOtpSendMobile: {
    id: "smsOtpSendMobile",
    description: "SMS OTP send — 5 req / hour / mobile",
    windowMs: 60 * 60 * 1000,
    max: 5,
    keyPrefix: "rl:auth:sms-otp:send:mobile",
    enabled: true,
  },

  /** SMS OTP verify — per IP. */
  smsOtpVerifyIp: {
    id: "smsOtpVerifyIp",
    description: "SMS OTP verify — 30 req / 10 min / IP",
    windowMs: 10 * 60 * 1000,
    max: 30,
    keyPrefix: "rl:auth:sms-otp:verify:ip",
    enabled: true,
  },
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
