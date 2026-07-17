import { isTokenVerified } from "@/json";
import { NextRequest, NextResponse } from "next/server";
import {
  GREETING_BATCH_SYSTEM_PROMPT,
  GREETING_SYSTEM_PROMPT,
  parseBatchGreetingResponse,
  sanitizeGreeting,
} from "./sanitizeGreeting";
import {
  buildPromptFromStructuredRequest,
  parseStructuredGreetingBody,
} from "./buildGreetingPrompt";

const DEFAULT_FALLBACK = "Your one-stop shop for everything you love.";
const WEATHER_FALLBACK =
  "Fast delivery. Reliable service. Everything you need at your doorstep.";
const CART_FALLBACK = "Welcome back! Ready to discover something new?";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const structured = parseStructuredGreetingBody(body);

    if (!structured) {
      return NextResponse.json(
        {
          error:
            'Invalid body. Send { type: "weather" | "cart" | "batch", payload: {...} }',
        },
        { status: 400 },
      );
    }

    const prompt = buildPromptFromStructuredRequest(
      structured.type,
      structured.payload,
    );

    const tokenVerificationResponse = await isTokenVerified(req);
    if (tokenVerificationResponse) {
      return tokenVerificationResponse;
    }

    const isBatch = structured.type === "batch";

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
            {
              role: "system",
              content: isBatch
                ? GREETING_BATCH_SYSTEM_PROMPT
                : GREETING_SYSTEM_PROMPT,
            },
            {
              role: "user",
              content: prompt,
            },
          ],
          model: "deepseek/deepseek-v3-0324",
          stream: false,
        }),
      },
    );

    if (!response.ok) {
      console.log("HF API error: ", response.status);
      if (isBatch) {
        return NextResponse.json({
          messages: [WEATHER_FALLBACK, CART_FALLBACK],
          weather: WEATHER_FALLBACK,
          cart: CART_FALLBACK,
        });
      }
      return NextResponse.json({ text: DEFAULT_FALLBACK }, { status: 200 });
    }

    const data = await response.json();
    const raw = data?.choices?.[0]?.message?.content?.trim();

    if (isBatch) {
      const parsed = parseBatchGreetingResponse(raw, {
        weather: WEATHER_FALLBACK,
        cart: CART_FALLBACK,
      });
      return NextResponse.json({
        messages: [parsed.weather, parsed.cart],
        weather: parsed.weather,
        cart: parsed.cart,
      });
    }

    const text = sanitizeGreeting(raw, DEFAULT_FALLBACK);
    return NextResponse.json({ text });
  } catch (err) {
    console.error("Error generating text:", err);
    return NextResponse.json({ text: DEFAULT_FALLBACK }, { status: 200 });
  }
}
