import nodemailer from "nodemailer";
import {
  ADMIN_OTP_EMAIL,
  getSmtpConfig,
} from "@/app/api/auth/adminOtpUtils";
import { log, logError, logWarn } from "@/app/api/lib/logger";
import type { CartItem } from "@/types/api";

const ADMIN_ORDER_EMAIL =
  process.env.ADMIN_ORDER_EMAIL || ADMIN_OTP_EMAIL;

export type AdminOrderEmailPayload = {
  humanOrderId: string;
  mongoOrderId: string;
  paymentMethod: string;
  amountPaid: number;
  subtotal?: number;
  deliveryFee?: number;
  userId?: string;
  addressData?: {
    name?: string;
    phone?: string;
    address?: string;
    [key: string]: unknown;
  } | null;
  cartItems?: CartItem[] | null;
};

function formatInr(amount: number) {
  return `₹${Number(amount || 0).toFixed(2)}`;
}

function productLine(item: CartItem): string {
  const details = (item.productDetails ?? {}) as {
    name?: string;
    discountedPrice?: number;
    price?: number;
  };
  const name = details.name || "Item";
  const qty = item.quantity ?? 0;
  const unit =
    typeof item.promoPrice === "number"
      ? item.promoPrice
      : typeof details.discountedPrice === "number"
        ? details.discountedPrice
        : typeof details.price === "number"
          ? details.price
          : 0;
  return `${name} × ${qty} — ${formatInr(unit * qty)}`;
}

/**
 * Notify admin by email when a customer order is placed.
 * Failures are logged only — never block order success.
 */
export async function sendAdminOrderPlacedEmail(
  payload: AdminOrderEmailPayload,
): Promise<void> {
  const smtpConfig = getSmtpConfig();
  if (!smtpConfig) {
    logWarn(
      "[order-email] SMTP not configured; skipping admin order email",
      payload.humanOrderId,
    );
    return;
  }

  const {
    humanOrderId,
    mongoOrderId,
    paymentMethod,
    amountPaid,
    subtotal,
    deliveryFee,
    userId,
    addressData,
    cartItems,
  } = payload;

  const itemLines = (cartItems ?? []).map(productLine);
  const addressBlock = [
    addressData?.name,
    addressData?.phone,
    addressData?.address,
  ]
    .filter(Boolean)
    .join("\n");

  const text = [
    `New order placed — ${humanOrderId}`,
    "",
    `Payment: ${paymentMethod}`,
    `Amount paid: ${formatInr(amountPaid)}`,
    subtotal != null ? `Subtotal: ${formatInr(subtotal)}` : null,
    deliveryFee != null ? `Delivery fee: ${formatInr(deliveryFee)}` : null,
    userId ? `Customer userId: ${userId}` : null,
    `Mongo order id: ${mongoOrderId}`,
    "",
    "Delivery address:",
    addressBlock || "(not provided)",
    "",
    "Items:",
    ...(itemLines.length ? itemLines : ["(no items)"]),
  ]
    .filter((line) => line != null)
    .join("\n");

  const htmlItems = itemLines.length
    ? `<ul>${itemLines.map((l) => `<li>${escapeHtml(l)}</li>`).join("")}</ul>`
    : "<p>(no items)</p>";

  const html = `
    <h2>New order placed</h2>
    <p><strong>Order ID:</strong> ${escapeHtml(humanOrderId)}</p>
    <p><strong>Payment:</strong> ${escapeHtml(paymentMethod)}</p>
    <p><strong>Amount paid:</strong> ${escapeHtml(formatInr(amountPaid))}</p>
    ${subtotal != null ? `<p><strong>Subtotal:</strong> ${escapeHtml(formatInr(subtotal))}</p>` : ""}
    ${deliveryFee != null ? `<p><strong>Delivery fee:</strong> ${escapeHtml(formatInr(deliveryFee))}</p>` : ""}
    ${userId ? `<p><strong>Customer userId:</strong> ${escapeHtml(userId)}</p>` : ""}
    <p><strong>Mongo order id:</strong> ${escapeHtml(mongoOrderId)}</p>
    <h3>Delivery address</h3>
    <pre style="font-family:inherit;white-space:pre-wrap">${escapeHtml(addressBlock || "(not provided)")}</pre>
    <h3>Items</h3>
    ${htmlItems}
  `;

  const transporter = nodemailer.createTransport(smtpConfig);

  try {
    await transporter.sendMail({
      from: smtpConfig.auth.user,
      to: ADMIN_ORDER_EMAIL,
      subject: `New order ${humanOrderId} — ${formatInr(amountPaid)} (${paymentMethod})`,
      text,
      html,
    });
    log("[order-email] admin notified", {
      humanOrderId,
      to: ADMIN_ORDER_EMAIL,
    });
  } catch (error) {
    logError("[order-email] failed to notify admin", {
      humanOrderId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
