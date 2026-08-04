export type ShopAssistPlanAction =
  | "search"
  | "ask"
  | "pick"
  | "checkout"
  | "cart_list"
  | "none";

export type ShopAssistPlanResult = {
  action: ShopAssistPlanAction;
  keyword?: string | null;
  preferSize?: string | null;
  preferQty?: number | null;
  index?: number | null;
  message?: string | null;
};

export const SHOP_ASSIST_SYSTEM_PROMPT = `You are Shop Assist for an Indian grocery delivery app (Ramnath Pansari).
Users type Hinglish/English with typos. Map their utterance to ONE JSON action.

Rules:
- Output ONLY valid JSON. No markdown fences, no commentary.
- Never invent product IDs. Never add to cart yourself.
- Prefer "search" with a clean English/Hindi grocery keyword when they want a product.
- Use preferSize like "1l","500ml","1kg" when clear; else null.
- Use preferQty 1-5 when they want to add a quantity; else null.
- If candidates are provided and they clearly pick one, use action "pick" with 1-based index.
- If unclear, use action "ask" with a short Hinglish/English clarifying question.
- "checkout" only for pay/place order/proceed — not "buy sugar".
- "cart_list" for show cart contents.
- "none" if you cannot help.

Schema:
{"action":"search"|"ask"|"pick"|"checkout"|"cart_list"|"none","keyword":string|null,"preferSize":string|null,"preferQty":number|null,"index":number|null,"message":string|null}`;

const ALLOWED = new Set<ShopAssistPlanAction>([
  "search",
  "ask",
  "pick",
  "checkout",
  "cart_list",
  "none",
]);

const FALLBACK_NONE: ShopAssistPlanResult = {
  action: "none",
  keyword: null,
  preferSize: null,
  preferQty: null,
  index: null,
  message:
    "Samajh nahi aaya. Product ka naam bolo — jaise Fortune mustard oil.",
};

function extractJsonObject(raw: string): unknown | null {
  const trimmed = raw.trim();
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fence?.[1]?.trim() ?? trimmed;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(body.slice(start, end + 1));
  } catch {
    return null;
  }
}

function clampQty(n: unknown): number | null {
  const v = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(v)) return null;
  const i = Math.round(v);
  if (i < 1 || i > 5) return null;
  return i;
}

/**
 * Sanitize model output into a safe Shop Assist plan.
 */
export function sanitizeShopAssistPlan(
  raw: string | undefined | null,
): ShopAssistPlanResult {
  if (!raw?.trim()) return { ...FALLBACK_NONE };

  const parsed = extractJsonObject(raw);
  if (!parsed || typeof parsed !== "object") return { ...FALLBACK_NONE };

  const obj = parsed as Record<string, unknown>;
  const actionRaw = String(obj.action ?? "none").toLowerCase();
  const action = (
    ALLOWED.has(actionRaw as ShopAssistPlanAction) ? actionRaw : "none"
  ) as ShopAssistPlanAction;

  const keyword =
    typeof obj.keyword === "string" && obj.keyword.trim().length >= 2
      ? obj.keyword.trim().slice(0, 80)
      : null;
  const preferSize =
    typeof obj.preferSize === "string" && obj.preferSize.trim()
      ? obj.preferSize.trim().toLowerCase().replace(/\s+/g, "").slice(0, 16)
      : null;
  const preferQty = clampQty(obj.preferQty);
  const indexRaw =
    typeof obj.index === "number" ? obj.index : Number(obj.index);
  const index =
    Number.isFinite(indexRaw) && indexRaw >= 1 && indexRaw <= 20
      ? Math.round(indexRaw)
      : null;
  const message =
    typeof obj.message === "string" && obj.message.trim()
      ? obj.message.trim().slice(0, 280)
      : null;

  if (action === "search" && !keyword) {
    return {
      ...FALLBACK_NONE,
      message: message ?? FALLBACK_NONE.message,
    };
  }
  if (action === "ask" && !message) {
    return { ...FALLBACK_NONE };
  }
  if (action === "pick" && index == null) {
    return { ...FALLBACK_NONE, message: message ?? FALLBACK_NONE.message };
  }

  return {
    action,
    keyword,
    preferSize,
    preferQty,
    index,
    message,
  };
}

export function buildShopAssistUserPrompt(input: {
  userText: string;
  language?: string;
  cartItemCount?: number;
  pendingProductSelection?: boolean;
  pendingQuantity?: boolean;
  pendingConfirmation?: boolean;
  candidates?: Array<{ i: number; name: string; size?: string | null }>;
}): string {
  const lines = [
    `User said: ${input.userText}`,
    `language: ${input.language ?? "auto"}`,
    `cartItemCount: ${input.cartItemCount ?? 0}`,
    `pendingProductSelection: ${Boolean(input.pendingProductSelection)}`,
    `pendingQuantity: ${Boolean(input.pendingQuantity)}`,
    `pendingConfirmation: ${Boolean(input.pendingConfirmation)}`,
  ];
  if (input.candidates?.length) {
    lines.push("candidates:");
    for (const c of input.candidates.slice(0, 12)) {
      lines.push(
        `${c.i}. ${c.name}${c.size ? ` (${c.size})` : ""}`,
      );
    }
  }
  return lines.join("\n");
}
