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
import type { DeliverySettings } from "@/app/api/delivery/deliverySettingsTypes";
import { DEFAULT_DELIVERY_SETTINGS } from "@/app/api/delivery/deliverySettingsTypes";
import type { StoreConfig } from "@/app/api/store/storeConfigTypes";
import { DEFAULT_STORE_CONFIG } from "@/app/api/store/storeConfigTypes";
import type { HomeProductPromo } from "@/app/api/home-promo/homePromoTypes";
import { DEFAULT_HOME_PRODUCT_PROMO } from "@/app/api/home-promo/homePromoTypes";
export type StoreSettingsDocument = {
  _id: "global";
  offers: Offer[];
  carouselBanners?: CarouselBanner[];
  deliverySettings?: DeliverySettings;
  storeConfig?: StoreConfig;
  homeProductPromo?: HomeProductPromo;
  updatedAt: Date;
};

export const DEFAULT_OFFERS: Offer[] = [];
export {
  DEFAULT_CAROUSEL_BANNERS,
  DEFAULT_DELIVERY_SETTINGS,
  DEFAULT_STORE_CONFIG,
  DEFAULT_HOME_PRODUCT_PROMO,
};
