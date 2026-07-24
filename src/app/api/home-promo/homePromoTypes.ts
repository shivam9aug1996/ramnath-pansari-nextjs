export type HomeProductPromo = {
  id: string;
  enabled: boolean;
  productId?: string;
  productName?: string;
  title?: string;
  ctaLabel?: string;
  /** Short muted loop preferred (5–15s). */
  videoUrl?: string;
  /** Shown while video loads / if video missing. */
  posterUrl?: string;
  startsAt?: string | null;
  endsAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

/** Disabled by default — enable via PUT /api/admin/home-promo. */
export const DEFAULT_HOME_PRODUCT_PROMO: HomeProductPromo = {
  id: "home-promo-1",
  enabled: false,
  productId: "",
  productName: "",
  title: "Today's pick",
  ctaLabel: "View product",
  videoUrl: "",
  posterUrl: "",
  startsAt: null,
  endsAt: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};
