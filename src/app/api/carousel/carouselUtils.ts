import type { Db } from "mongodb";
import { ObjectId } from "mongodb";
import { findCategoryById } from "@/app/api/admin/categories/categoryUtils";
import type { CategoryNode } from "@/app/api/admin/categories/categoryUtils";
import { getStoreSettings } from "@/app/api/offers/offerUtils";
import type {
  CarouselActionType,
  CarouselBanner,
} from "./carouselTypes";

export async function getAllCarouselBanners(db: Db): Promise<CarouselBanner[]> {
  const settings = await getStoreSettings(db);
  return (settings.carouselBanners ?? []).sort(compareCarouselBanners);
}

export function compareCarouselBanners(
  a: CarouselBanner,
  b: CarouselBanner,
): number {
  const orderDiff = a.sortOrder - b.sortOrder;
  if (orderDiff !== 0) return orderDiff;

  const createdDiff =
    new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  if (createdDiff !== 0) return createdDiff;

  return a.id.localeCompare(b.id);
}

export async function getEnabledCarouselBanners(
  db: Db,
): Promise<CarouselBanner[]> {
  const banners = await getAllCarouselBanners(db);
  return banners.filter((banner) => banner.enabled);
}

export async function saveCarouselBanners(
  db: Db,
  banners: CarouselBanner[],
): Promise<void> {
  await db.collection("storeSettings").updateOne(
    { _id: "global" },
    {
      $set: {
        carouselBanners: banners,
        updatedAt: new Date(),
      },
      $setOnInsert: { _id: "global" },
    },
    { upsert: true },
  );
}

export function normalizeCarouselBannerForResponse(
  banner: CarouselBanner,
): CarouselBanner {
  return {
    ...banner,
    sortOrder: Number(banner.sortOrder) || 0,
  };
}

export function validateCarouselInput(
  body: Partial<CarouselBanner>,
  isUpdate = false,
): { valid: boolean; message?: string } {
  if (!isUpdate && !body.imageUrl?.trim()) {
    return { valid: false, message: "imageUrl is required" };
  }

  if (body.imageUrl != null && !body.imageUrl.trim()) {
    return { valid: false, message: "imageUrl cannot be empty" };
  }

  if (
    body.actionType &&
    body.actionType !== "none" &&
    body.actionType !== "scroll_categories" &&
    body.actionType !== "category"
  ) {
    return { valid: false, message: "Invalid actionType" };
  }

  const actionType = body.actionType ?? "none";
  if (actionType === "category") {
    const categoryId = body.categoryId?.trim();
    if (!categoryId || !ObjectId.isValid(categoryId)) {
      return {
        valid: false,
        message: "category action requires a valid categoryId",
      };
    }
  }

  if (body.sortOrder != null && body.sortOrder < 0) {
    return { valid: false, message: "sortOrder must be >= 0" };
  }

  return { valid: true };
}

export async function validateCarouselCategoryExists(
  db: Db,
  body: Partial<CarouselBanner>,
): Promise<{ valid: boolean; message?: string }> {
  if (body.actionType !== "category") {
    return { valid: true };
  }

  const categoryId = body.categoryId?.trim();
  if (!categoryId) {
    return { valid: false, message: "categoryId is required" };
  }

  if (!ObjectId.isValid(categoryId)) {
    return { valid: false, message: `Invalid categoryId: ${categoryId}` };
  }

  const roots = (await db.collection("categories").find({}).toArray()) as CategoryNode[];
  const category = findCategoryById(roots, categoryId);

  if (!category) {
    return { valid: false, message: `Category not found: ${categoryId}` };
  }

  return { valid: true };
}

export function buildCarouselBannerFromInput(
  body: Partial<CarouselBanner>,
  existing?: CarouselBanner,
): CarouselBanner {
  const now = new Date().toISOString();
  const actionType = (body.actionType ??
    existing?.actionType ??
    "none") as CarouselActionType;

  return {
    id: existing?.id ?? body.id ?? crypto.randomUUID(),
    enabled: body.enabled ?? existing?.enabled ?? true,
    sortOrder: Number(body.sortOrder ?? existing?.sortOrder ?? 0),
    imageUrl: (body.imageUrl ?? existing?.imageUrl ?? "").trim(),
    actionType,
    categoryId:
      actionType === "category"
        ? (body.categoryId ?? existing?.categoryId)?.trim()
        : undefined,
    categoryName:
      actionType === "category"
        ? body.categoryName?.trim() || existing?.categoryName
        : undefined,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
}
