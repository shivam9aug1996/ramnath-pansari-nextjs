import { randomInt } from "crypto";
import type { Db } from "mongodb";
import bcrypt from "bcryptjs";

import {
  ADMIN_MOBILE_FALLBACK,
  DRIVER_MOBILE_FALLBACK,
  GUEST_MOBILE,
} from "@/app/api/admin/users/userUtils";
import { log, logError, logWarn } from "@/app/api/lib/logger";

export const SMS_OTP_TTL_MS = 5 * 60 * 1000;
export const SMS_OTP_RESEND_COOLDOWN_MS = 45_000;
export const SMS_OTP_MAX_VERIFY_ATTEMPTS = 5;
export const SMS_OTP_MAX_SENDS_PER_HOUR = 5;

const LOGIN_OTPS = "loginOtps";

export type LoginOtpRecord = {
  mobileNumber: string;
  otpHash: string;
  expiresAt: Date;
  createdAt: Date;
  lastSentAt: Date;
  attempts: number;
  sendCountWindowStart: Date;
  sendCount: number;
};

export function normalizeMobileNumber(raw: unknown): string | null {
  if (typeof raw !== "string" && typeof raw !== "number") return null;
  const digits = String(raw).replace(/\D/g, "");
  const ten =
    digits.length === 12 && digits.startsWith("91")
      ? digits.slice(2)
      : digits.length === 11 && digits.startsWith("0")
        ? digits.slice(1)
        : digits;
  if (!/^[6-9]\d{9}$/.test(ten)) return null;
  return ten;
}

export function isReservedLoginMobile(mobileNumber: string) {
  return (
    mobileNumber === ADMIN_MOBILE_FALLBACK ||
    mobileNumber === DRIVER_MOBILE_FALLBACK ||
    mobileNumber === GUEST_MOBILE
  );
}

function generateOtp() {
  return String(randomInt(100000, 1000000));
}

function getBlackSmsConfig() {
  const authKey = process.env.BLACKSMS_AUTH_KEY?.trim();
  if (!authKey) return null;
  return {
    authKey,
    senderId: process.env.BLACKSMS_SENDER_ID?.trim() || "697",
    route: process.env.BLACKSMS_ROUTE?.trim() || "1",
    url: process.env.BLACKSMS_URL?.trim() || "https://blacksms.in/sms",
  };
}

async function sendBlackSms(mobileNumber: string, otp: string) {
  const config = getBlackSmsConfig();
  if (!config) {
    log("[sms-otp] BLACKSMS_AUTH_KEY not set. Dev OTP:", otp);
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "SMS provider is not configured (set BLACKSMS_AUTH_KEY)",
      );
    }
    return;
  }

  const res = await fetch(config.url, {
    method: "POST",
    headers: {
      Authorization: config.authKey,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      sender_id: config.senderId,
      route: config.route,
      variables_values: otp,
      numbers: mobileNumber,
    }),
  });

  const bodyText = await res.text();
  if (!res.ok) {
    logError("[sms-otp] BlackSMS failed", res.status, bodyText.slice(0, 300));
    throw new Error("Failed to send OTP SMS");
  }
}

export type CreateSmsOtpResult =
  | { ok: true }
  | {
      ok: false;
      code: "cooldown" | "hourly_cap";
      retryAfterSeconds: number;
    };

export async function createAndSendLoginOtp(
  db: Db,
  mobileNumber: string,
): Promise<CreateSmsOtpResult> {
  const now = new Date();
  const existing = await db
    .collection<LoginOtpRecord>(LOGIN_OTPS)
    .findOne({ mobileNumber });

  if (existing?.lastSentAt) {
    const elapsed = now.getTime() - new Date(existing.lastSentAt).getTime();
    if (elapsed < SMS_OTP_RESEND_COOLDOWN_MS) {
      return {
        ok: false,
        code: "cooldown",
        retryAfterSeconds: Math.max(
          Math.ceil((SMS_OTP_RESEND_COOLDOWN_MS - elapsed) / 1000),
          1,
        ),
      };
    }
  }

  const hourMs = 60 * 60 * 1000;
  let sendCount = 1;
  let sendCountWindowStart = now;
  if (existing?.sendCountWindowStart) {
    const windowStart = new Date(existing.sendCountWindowStart);
    if (now.getTime() - windowStart.getTime() < hourMs) {
      sendCount = (existing.sendCount ?? 0) + 1;
      sendCountWindowStart = windowStart;
      if (sendCount > SMS_OTP_MAX_SENDS_PER_HOUR) {
        const retryAfterSeconds = Math.max(
          Math.ceil((hourMs - (now.getTime() - windowStart.getTime())) / 1000),
          1,
        );
        return { ok: false, code: "hourly_cap", retryAfterSeconds };
      }
    }
  }

  const otp = generateOtp();
  const otpHash = await bcrypt.hash(otp, 10);
  const record: LoginOtpRecord = {
    mobileNumber,
    otpHash,
    expiresAt: new Date(now.getTime() + SMS_OTP_TTL_MS),
    createdAt: existing?.createdAt ?? now,
    lastSentAt: now,
    attempts: 0,
    sendCountWindowStart,
    sendCount,
  };

  try {
    await sendBlackSms(mobileNumber, otp);
  } catch (error) {
    logWarn("[sms-otp] send failed; OTP not committed", error);
    throw error;
  }

  // Persist only after SMS succeeds so failed sends don't burn cooldown.
  await db
    .collection<LoginOtpRecord>(LOGIN_OTPS)
    .updateOne({ mobileNumber }, { $set: record }, { upsert: true });

  return { ok: true };
}

export type VerifySmsOtpResult =
  | { ok: true }
  | {
      ok: false;
      code: "invalid" | "expired" | "locked" | "missing";
    };

export async function verifyLoginOtp(
  db: Db,
  mobileNumber: string,
  otp: string,
): Promise<VerifySmsOtpResult> {
  const record = await db
    .collection<LoginOtpRecord>(LOGIN_OTPS)
    .findOne({ mobileNumber });

  if (!record) return { ok: false, code: "missing" };

  if (record.attempts >= SMS_OTP_MAX_VERIFY_ATTEMPTS) {
    return { ok: false, code: "locked" };
  }

  if (new Date(record.expiresAt) < new Date()) {
    await db.collection(LOGIN_OTPS).deleteOne({ mobileNumber });
    return { ok: false, code: "expired" };
  }

  const isValid = await bcrypt.compare(String(otp).trim(), record.otpHash);
  if (!isValid) {
    await db
      .collection(LOGIN_OTPS)
      .updateOne({ mobileNumber }, { $inc: { attempts: 1 } });
    const nextAttempts = (record.attempts ?? 0) + 1;
    if (nextAttempts >= SMS_OTP_MAX_VERIFY_ATTEMPTS) {
      return { ok: false, code: "locked" };
    }
    return { ok: false, code: "invalid" };
  }

  await db.collection(LOGIN_OTPS).deleteOne({ mobileNumber });
  return { ok: true };
}
