import type { Db } from "mongodb";
import bcrypt from "bcryptjs";
import nodemailer from "nodemailer";
import {
  ADMIN_MOBILE_FALLBACK,
  resolveIsAdmin,
  type UserDocument,
} from "@/app/api/admin/users/userUtils";
import { log, logError, logWarn } from "@/app/api/lib/logger";

export const ADMIN_OTP_EMAIL =
  process.env.ADMIN_OTP_EMAIL || "shivam9aug1996@gmail.com";

const ADMIN_OTP_TTL_MS = 10 * 60 * 1000;

type AdminOtpRecord = {
  mobileNumber: string;
  otpHash: string;
  expiresAt: Date;
  createdAt: Date;
};

export function isAdminMobile(mobileNumber: string) {
  return mobileNumber === ADMIN_MOBILE_FALLBACK;
}

export function isAdminLoginAttempt(
  mobileNumber: string,
  user: UserDocument | null,
) {
  if (!isAdminMobile(mobileNumber) || !user) return false;
  return resolveIsAdmin(user);
}

export function maskEmail(email: string) {
  const [local, domain] = email.split("@");
  if (!local || !domain) return "***";
  return `${local[0]}***@${domain}`;
}

function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function getSmtpConfig() {
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!user || !pass) return null;

  return {
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: Number(process.env.SMTP_PORT || 465),
    secure: process.env.SMTP_SECURE !== "false",
    auth: { user, pass },
  };
}

async function sendAdminOtpEmail(otp: string) {
  const smtpConfig = getSmtpConfig();

  if (!smtpConfig) {
    log("[admin-otp] SMTP not configured. OTP for dev:", otp);
    if (process.env.NODE_ENV === "production") {
      throw new Error("SMTP is not configured");
    }
    return;
  }

  const transporter = nodemailer.createTransport(smtpConfig);

  try {
    await transporter.sendMail({
      from: smtpConfig.auth.user,
      to: ADMIN_OTP_EMAIL,
      subject: "Ramnath Pansari admin login OTP",
      text: `Your admin login OTP is ${otp}. It expires in 10 minutes.`,
      html: `<p>Your admin login OTP is <strong>${otp}</strong>.</p><p>It expires in 10 minutes.</p>`,
    });
  } catch (error) {
    const isAuthError =
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "EAUTH";

    if (process.env.NODE_ENV !== "production") {
      logWarn(
        "[admin-otp] Email send failed; using dev fallback OTP:",
        otp,
        isAuthError
          ? "(Gmail needs an App Password in SMTP_PASS, not your login password)"
          : error,
      );
      return;
    }

    if (isAuthError) {
      throw new Error(
        "Gmail SMTP auth failed. Set SMTP_PASS to a Gmail App Password.",
      );
    }

    throw error;
  }
}

export async function createAndSendAdminOtp(db: Db, mobileNumber: string) {
  const otp = generateOtp();
  const otpHash = await bcrypt.hash(otp, 10);
  const now = new Date();
  const record: AdminOtpRecord = {
    mobileNumber,
    otpHash,
    expiresAt: new Date(now.getTime() + ADMIN_OTP_TTL_MS),
    createdAt: now,
  };

  await db
    .collection<AdminOtpRecord>("adminOtps")
    .updateOne({ mobileNumber }, { $set: record }, { upsert: true });

  await sendAdminOtpEmail(otp);

  return { otpSentTo: maskEmail(ADMIN_OTP_EMAIL) };
}

export async function verifyAdminOtp(
  db: Db,
  mobileNumber: string,
  otp: string,
) {
  const record = await db
    .collection<AdminOtpRecord>("adminOtps")
    .findOne({ mobileNumber });

  if (!record) return false;

  if (record.expiresAt < new Date()) {
    await db.collection("adminOtps").deleteOne({ mobileNumber });
    return false;
  }

  const isValid = await bcrypt.compare(otp, record.otpHash);
  if (isValid) {
    await db.collection("adminOtps").deleteOne({ mobileNumber });
  }

  return isValid;
}

export async function clearAdminOtp(db: Db, mobileNumber: string) {
  try {
    await db.collection("adminOtps").deleteOne({ mobileNumber });
  } catch (error) {
    logError("clearAdminOtp failed", error);
  }
}
