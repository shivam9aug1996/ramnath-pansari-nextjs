import { isTokenVerified } from "@/json";
import { NextRequest, NextResponse } from "next/server";
import {
  GREETING_SYSTEM_PROMPT,
  sanitizeGreeting,
} from "./sanitizeGreeting";

const DEFAULT_FALLBACK = "Your one-stop shop for everything you love.";

export async function POST(req: NextRequest) {
  try {
    const { prompt } = await req.json();
    if (!prompt) {
      return NextResponse.json(
        { error: "Prompt is required" },
        { status: 400 },
      );
    }
    const tokenVerificationResponse = await isTokenVerified(req);
    if (tokenVerificationResponse) {
      return tokenVerificationResponse;
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
            {
              role: "system",
              content: GREETING_SYSTEM_PROMPT,
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
      return NextResponse.json({ text: DEFAULT_FALLBACK }, { status: 200 });
    }
    const data = await response.json();
    const raw = data?.choices?.[0]?.message?.content?.trim();
    const text = sanitizeGreeting(raw, DEFAULT_FALLBACK);
    return NextResponse.json({ text });
  } catch (err) {
    console.error("Error generating text:", err);
    return NextResponse.json({ text: DEFAULT_FALLBACK }, { status: 200 });
  }
}
