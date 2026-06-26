import { isTokenVerified } from "@/json";
import { NextRequest, NextResponse } from "next/server";
import { logError } from "../../lib/logger";
import { releaseCheckoutHolds } from "../../utils/productPendingLock";

export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");
    const { productIds } = await req.json();

    if (!userId || !Array.isArray(productIds)) {
      return NextResponse.json({ message: "Invalid input" }, { status: 400 });
    }

    const tokenVerificationResponse = await isTokenVerified(req);
    if (tokenVerificationResponse) return tokenVerificationResponse;

    const ids = productIds.map((id) => String(id)).filter(Boolean);
    await releaseCheckoutHolds(userId, ids, "checkout-aborted");

    return NextResponse.json(
      { message: "Checkout holds released", releasedCount: ids.length },
      { status: 200 },
    );
  } catch (error) {
    logError("[product-lock] releaseCheckoutHolds:error", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 },
    );
  }
}
