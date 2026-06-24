export type OfferRewardType = "freebie" | "discount";

export type FreebieReward = {
  productId: string;
  quantity: number;
  promoPrice?: number;
  label?: string;
};

export type DiscountReward = {
  kind: "flat" | "percent";
  value: number;
  maxDiscount?: number;
  label?: string;
};

export type Offer = {
  id: string;
  enabled: boolean;
  type: OfferRewardType;
  minOrderValue: number;
  sortOrder: number;
  freebies?: FreebieReward[];
  discount?: DiscountReward;
  createdAt: string;
  updatedAt: string;
};

import type { CarouselBanner } from "@/app/api/carousel/carouselTypes";
import { DEFAULT_CAROUSEL_BANNERS } from "@/app/api/carousel/carouselTypes";

export type StoreSettingsDocument = {
  _id: "global";
  offers: Offer[];
  carouselBanners?: CarouselBanner[];
  updatedAt: Date;
};

export const DEFAULT_OFFERS: Offer[] = [];
export { DEFAULT_CAROUSEL_BANNERS };
