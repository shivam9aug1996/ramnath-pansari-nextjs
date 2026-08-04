import { isTokenVerified } from "@/json";
import { NextRequest, NextResponse } from "next/server";
import {
  SHOP_ASSIST_SYSTEM_PROMPT,
  buildShopAssistUserPrompt,
  sanitizeShopAssistPlan,
  type ShopAssistPlanResult,
} from "./sanitizePlan";

const SOFT_NONE: ShopAssistPlanResult = {
  action: "none",
  keyword: null,
  preferSize: null,
  preferQty: null,
  index: null,
  message:
    "Samajh nahi aaya. Product ka naam bolo — jaise Fortune mustard oil.",
};

export async function POST(req: NextRequest) {
  try {
    const tokenVerificationResponse = await isTokenVerified(req);
    if (tokenVerificationResponse) {
      return tokenVerificationResponse;
    }

    const body = await req.json().catch(() => null);
    const userText =
      typeof body?.userText === "string" ? body.userText.trim() : "";
    if (!userText || userText.length > 500) {
      return NextResponse.json(
        { error: "userText is required (max 500 chars)" },
        { status: 400 },
      );
    }

    const session =
      body?.session && typeof body.session === "object" ? body.session : {};
    const candidates = Array.isArray(body?.candidates)
      ? body.candidates
          .slice(0, 12)
          .map((c: any, idx: number) => ({
            i: typeof c?.i === "number" ? c.i : idx + 1,
            name: String(c?.name ?? "").slice(0, 120),
            size: c?.size != null ? String(c.size).slice(0, 32) : null,
          }))
          .filter((c: { name: string }) => c.name.length > 0)
      : [];

    const userPrompt = buildShopAssistUserPrompt({
      userText,
      language: session.language,
      cartItemCount: session.cartItemCount,
      pendingProductSelection: session.pendingProductSelection,
      pendingQuantity: session.pendingQuantity,
      pendingConfirmation: Boolean(session.pendingConfirmation),
      candidates,
    });

    if (!process.env.HF_TOKEN) {
      console.error("shop-assist/plan: HF_TOKEN missing");
      return NextResponse.json(SOFT_NONE);
    }

    const response = await fetch(
      "https://router.huggingface.co/novita/v3/openai/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.HF_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: [
            { role: "system", content: SHOP_ASSIST_SYSTEM_PROMPT },
            { role: "user", content: userPrompt },
          ],
          model: "deepseek/deepseek-v3-0324",
          stream: false,
          temperature: 0.2,
        }),
      },
    );

    if (!response.ok) {
      console.log("shop-assist HF API error:", response.status);
      return NextResponse.json(SOFT_NONE);
    }

    const data = await response.json();
    const raw = data?.choices?.[0]?.message?.content?.trim();
    const plan = sanitizeShopAssistPlan(raw);
    return NextResponse.json(plan);
  } catch (err) {
    console.error("shop-assist/plan error:", err);
    return NextResponse.json(SOFT_NONE);
  }
}
