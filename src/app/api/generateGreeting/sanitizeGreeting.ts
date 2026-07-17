const META_LINE =
  /^\s*(\(Note:|Note:|Instructions:|If you'd prefer|Output:|📝|🚫|✅|Here'?s your)/i;

const PROMPT_LIKE =
  /(Instructions:|Output:|Generate \*\*exactly|Do not:|🛍️ Context|Cart items:|Recently viewed:)/i;

const DEFAULT_FALLBACK = "Your one-stop shop for everything you love.";

export const GREETING_SYSTEM_PROMPT = `You write one-line homepage banner text for a grocery delivery app.

Rules:
- Output ONLY the banner sentence. No quotes, labels, markdown, bullet lists, or parenthetical notes.
- Never output "(Note:", "If you'd prefer", "Instructions:", or explain your word choices.
- Maximum 25 words, at most one emoji, warm and casual tone.
- Light Hinglish is OK when it fits naturally.
- Do not ask questions or invite replies.
- If you cannot comply, output exactly: Happy shopping! 🛒`;

export const GREETING_BATCH_SYSTEM_PROMPT = `You write homepage banner text for a grocery delivery app.

Rules:
- Return ONLY valid JSON: {"weather":"...","cart":"..."}
- No markdown fences, labels, or extra keys.
- Each value is one banner sentence, max 25 words, at most one emoji, warm and casual.
- Light Hinglish is OK.
- Do not ask questions.
- weather and cart must be different lines.
- If you cannot comply, return {"weather":"Happy shopping! 🛒","cart":"Welcome back! Ready to discover something new?"}`;

export function sanitizeGreeting(
  raw: string | undefined | null,
  fallback: string = DEFAULT_FALLBACK,
): string {
  if (!raw?.trim()) {
    return fallback;
  }

  let text = raw.trim().replace(/^["']|["']$/g, "");

  const noteIndex = text.search(/\s*\(Note:/i);
  if (noteIndex > 0) {
    text = text.slice(0, noteIndex);
  }

  text = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !META_LINE.test(line))
    .join(" ")
    .replace(/[\r\n]+/g, " ")
    .replace(/\s\s+/g, " ")
    .trim();

  if (!text || PROMPT_LIKE.test(text) || text.length < 8) {
    return fallback;
  }

  if (text.length > 120) {
    return `${text.slice(0, 117).trim()}…`;
  }

  return text;
}

export function parseBatchGreetingResponse(
  raw: string | undefined | null,
  fallbacks: { weather: string; cart: string },
): { weather: string; cart: string } {
  if (!raw?.trim()) {
    return fallbacks;
  }

  let text = raw.trim();
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    text = fenced[1].trim();
  }

  const objectMatch = text.match(/\{[\s\S]*\}/);
  if (objectMatch) {
    text = objectMatch[0];
  }

  try {
    const parsed = JSON.parse(text) as {
      weather?: unknown;
      cart?: unknown;
    };
    return {
      weather: sanitizeGreeting(
        typeof parsed.weather === "string" ? parsed.weather : null,
        fallbacks.weather,
      ),
      cart: sanitizeGreeting(
        typeof parsed.cart === "string" ? parsed.cart : null,
        fallbacks.cart,
      ),
    };
  } catch {
    return fallbacks;
  }
}
