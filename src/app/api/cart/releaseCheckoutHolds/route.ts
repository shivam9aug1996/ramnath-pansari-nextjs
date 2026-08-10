import { NextRequest, NextResponse } from "next/server";
import { logError } from "../../lib/logger";
import { releaseCheckoutHolds } from "../../utils/productPendingLock";
import { requireSameUser } from "@/app/api/lib/requireAuth";

export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");
    const { productIds } = await req.json();

    if (!userId || !Array.isArray(productIds)) {
      return NextResponse.json({ message: "Invalid input" }, { status: 400 });
    }

    const auth = await requireSameUser(req, userId);
    if (auth instanceof NextResponse) return auth;

    const ids = productIds.map((id) => String(id)).filter(Boolean);
    await releaseCheckoutHolds(auth.userId, ids, "checkout-aborted");

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
