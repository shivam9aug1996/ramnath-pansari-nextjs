export type CarouselActionType = "none" | "scroll_categories" | "category";

export type CarouselBanner = {
  id: string;
  enabled: boolean;
  sortOrder: number;
  imageUrl: string;
  actionType: CarouselActionType;
  categoryId?: string;
  categoryName?: string;
  createdAt: string;
  updatedAt: string;
};

export const DEFAULT_CAROUSEL_BANNERS: CarouselBanner[] = [
  {
    id: "default-banner-1",
    enabled: true,
    sortOrder: 0,
    imageUrl:
      "https://res.cloudinary.com/dc2z2c3u8/image/upload/v1782298092/banner1_xpqxm6.png",
    actionType: "scroll_categories",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "default-banner-2",
    enabled: true,
    sortOrder: 1,
    imageUrl:
      "https://res.cloudinary.com/dc2z2c3u8/image/upload/v1782298092/banner2_eowlvv.png",
    actionType: "scroll_categories",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "default-banner-dals",
    enabled: true,
    sortOrder: 2,
    imageUrl:
      "https://rukminim2.flixcart.com/fk-p-flap/960/420/image/4f42398937013ef1.jpg?q=100",
    actionType: "category",
    categoryId: "66a2498a50d9ec140942917d",
    categoryName: "Dals & Pulses",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "default-banner-coffee",
    enabled: true,
    sortOrder: 3,
    imageUrl:
      "https://rukminim2.flixcart.com/fk-p-flap/960/420/image/61725d49f1a21828.jpeg?q=100",
    actionType: "category",
    categoryId: "67a5879461d60ec5eb8b4266",
    categoryName: "Coffee",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "default-banner-tea",
    enabled: true,
    sortOrder: 4,
    imageUrl:
      "https://rukminim2.flixcart.com/fk-p-flap/960/420/image/4fb35b7f555375d7.jpeg?q=100",
    actionType: "category",
    categoryId: "67a5883461d60ec5eb8b426a",
    categoryName: "Tea",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];
