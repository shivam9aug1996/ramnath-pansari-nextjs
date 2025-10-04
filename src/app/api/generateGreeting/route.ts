import { isTokenVerified } from "@/json";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { prompt } = await req.json();

    if (!prompt) {
      return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
    }
    const tokenVerificationResponse = await isTokenVerified(req);
    if (tokenVerificationResponse) {
      return tokenVerificationResponse;
    }

    const response = await fetch("https://router.huggingface.co/novita/v3/openai/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.HF_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
        model: "deepseek/deepseek-v3-0324",
        stream: false,
      }),
    });

    if (!response.ok) {
      console.log("HF API error: ", response.status);
      return NextResponse.json(
        { text: "Your one-stop shop for everything you love." },
        { status: 200 }
      );
    }

    const data = await response.json();
    const text = data?.choices?.[0]?.message?.content?.trim();

    return NextResponse.json({
      text: text || "Your one-stop shop for everything you love.",
    });
  } catch (err) {
    console.error("Error generating text:", err);

    // Return fallback message
    return NextResponse.json(
      { text: "Your one-stop shop for everything you love." },
      { status: 200 }
    );
  }
}
