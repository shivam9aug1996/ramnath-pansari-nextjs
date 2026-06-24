import type { NextRequest } from "next/server";
import type { ClientSession, UpdateFilter, Document } from "mongodb";
import type { ObjectId } from "mongodb";

export type ApiRequest = NextRequest;

export type ApiError = Error & {
  code?: number | string;
  status?: number;
};

export type CartItem = {
  productId: ObjectId;
  quantity: number;
  productDetails?: Record<string, unknown> | null;
  isPromoFreebie?: boolean;
  offerId?: string;
  promoPrice?: number;
};

export type CartDocument = {
  _id?: ObjectId;
  userId: ObjectId;
  items: CartItem[];
};

export type MongoSession = ClientSession;

export function asMongoUpdate(
  update: Record<string, unknown>,
): UpdateFilter<Document> {
  return update as UpdateFilter<Document>;
}
