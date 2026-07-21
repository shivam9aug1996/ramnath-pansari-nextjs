import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { connectDB } from "@/app/api/lib/dbconnection";
import {
  getEnabledOffers,
  normalizeOfferForResponse,
} from "@/app/api/offers/offerUtils";
import type { Offer } from "@/app/api/offers/offerTypes";
import { isTokenVerified } from "@/json";
import { NextRequest } from "next/server";

async function enrichOffersWithProductSnapshots(
  db: Awaited<ReturnType<typeof connectDB>>,
  offers: Offer[],
) {
  return Promise.all(
    offers.map(async (offer) => {
      if (offer.type !== "freebie" || !offer.freebies?.length) {
        return offer;
      }

      const freebies = await Promise.all(
        offer.freebies.map(async (freebie) => {
          const product = await db.collection("products").findOne({
            _id: new ObjectId(freebie.productId),
          });
          if (!product) return freebie;

          const promoPrice = freebie.promoPrice ?? 0;
          return {
            ...freebie,
            productSnapshot: {
              _id: freebie.productId,
              name: product.name,
              image: product.image ?? null,
              price: product.price,
              size: product.size,
              discountedPrice: promoPrice,
            },
          };
        }),
      );

      return { ...offer, freebies };
    }),
  );
}

export async function GET(req: NextRequest) {
  try {
    const tokenVerificationResponse = await isTokenVerified(req);
    if (tokenVerificationResponse) {
      return tokenVerificationResponse;
    }
    const db = await connectDB(req);
    const offers = await getEnabledOffers(db);
    const enriched = await enrichOffersWithProductSnapshots(db, offers);
    return NextResponse.json(
      {
        offers: enriched.map(normalizeOfferForResponse),
      },
      {
        status: 200,
      },
    );
  } catch (error) {
    console.error("[offers] GET error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL", message: "Failed to fetch offers" } },
      { status: 500 },
    );
  }
}
