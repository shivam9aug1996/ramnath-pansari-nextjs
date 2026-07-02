import { ObjectId } from "mongodb";
import bcrypt from "bcryptjs";

export const ADMIN_MOBILE_FALLBACK = "8888888888";
export const GUEST_MOBILE = "9999999991";
export const DRIVER_MOBILE_FALLBACK = "7777777771";

export type UserDocument = {
  _id?: ObjectId;
  mobileNumber?: string;
  password?: string;
  name?: string;
  profileImage?: unknown;
  khataUrl?: string;
  isAdminUser?: boolean;
  isDriverUser?: boolean;
  createdAt?: Date;
  [key: string]: unknown;
};

export type NormalizedUser = {
  _id: string;
  mobileNumber: string;
  name: string | null;
  khataUrl: string | null;
  profileImage: unknown;
  isAdminUser: boolean;
  isGuestUser: boolean;
  isDriverUser: boolean;
  driverId?: string;
  orderCount?: number;
  createdAt?: string;
};

function toIso(value: unknown) {
  try {
    if (!value) return undefined;
    const d = new Date(value as string | Date);
    return isNaN(d.getTime()) ? undefined : d.toISOString();
  } catch {
    return undefined;
  }
}

export function resolveIsAdmin(user: UserDocument) {
  return (
    Boolean(user.isAdminUser) || user.mobileNumber === ADMIN_MOBILE_FALLBACK
  );
}

export function resolveIsGuest(user: UserDocument) {
  return user.mobileNumber === GUEST_MOBILE;
}

export function resolveIsDriver(user: UserDocument) {
  return (
    Boolean(user.isDriverUser) || user.mobileNumber === DRIVER_MOBILE_FALLBACK
  );
}

export function normalizeUserForResponse(
  user: UserDocument | null,
  extras?: { orderCount?: number },
): NormalizedUser | null {
  if (!user) return null;

  return {
    _id: user._id?.toString() ?? "",
    mobileNumber: String(user.mobileNumber ?? ""),
    name: user.name ? String(user.name) : null,
    khataUrl: user.khataUrl ? String(user.khataUrl) : null,
    profileImage: user.profileImage ?? null,
    isAdminUser: resolveIsAdmin(user),
    isGuestUser: resolveIsGuest(user),
    isDriverUser: resolveIsDriver(user),
    driverId:
      resolveIsDriver(user) && user.driverId != null && String(user.driverId).trim()
        ? String(user.driverId)
        : resolveIsDriver(user)
          ? user._id?.toString()
          : undefined,
    orderCount: extras?.orderCount,
    createdAt: toIso(user.createdAt),
  };
}

export function buildUserSearchFilter(search: string) {
  if (!search.trim()) return {};
  const regex = { $regex: search.trim(), $options: "i" };
  return {
    $or: [{ name: regex }, { mobileNumber: regex }, { khataUrl: regex }],
  };
}

export function buildUserListFilter(role?: string) {
  const filter: Record<string, unknown> = {};

  if (role === "admin") {
    filter.$or = [
      { isAdminUser: true },
      { mobileNumber: ADMIN_MOBILE_FALLBACK },
    ];
  } else if (role === "customer") {
    filter.isAdminUser = { $ne: true };
    filter.isDriverUser = { $ne: true };
    filter.mobileNumber = {
      $nin: [ADMIN_MOBILE_FALLBACK, GUEST_MOBILE, DRIVER_MOBILE_FALLBACK],
    };
  } else if (role === "guest") {
    filter.mobileNumber = GUEST_MOBILE;
  } else if (role === "driver") {
    filter.isDriverUser = true;
  }

  return filter;
}

export function validateUserCreateInput(body: Record<string, unknown>) {
  const mobileNumber = String(body.mobileNumber ?? "").trim();
  const password = String(body.password ?? "");
  const name = body.name != null ? String(body.name).trim() : "";

  if (!/^\d{10}$/.test(mobileNumber)) {
    return { valid: false, message: "Valid 10-digit mobile number is required" };
  }
  if (password.length < 4) {
    return { valid: false, message: "Password must be at least 4 characters" };
  }

  return {
    valid: true,
    mobileNumber,
    password,
    name: name || undefined,
    isAdminUser: Boolean(body.isAdminUser),
    isDriverUser: Boolean(body.isDriverUser),
  };
}

export function validateUserUpdateInput(body: Record<string, unknown>) {
  const patch: {
    name?: string;
    khataUrl?: string | null;
    isAdminUser?: boolean;
    isDriverUser?: boolean;
    password?: string;
  } = {};

  if (body.name !== undefined) {
    const name = String(body.name).trim();
    if (!name) {
      return { valid: false, message: "Name cannot be empty" };
    }
    patch.name = name;
  }

  if (body.khataUrl !== undefined) {
    patch.khataUrl = body.khataUrl ? String(body.khataUrl).trim() : null;
  }

  if (body.isAdminUser !== undefined) {
    patch.isAdminUser = Boolean(body.isAdminUser);
  }

  if (body.isDriverUser !== undefined) {
    patch.isDriverUser = Boolean(body.isDriverUser);
  }

  if (body.password !== undefined && body.password !== "") {
    const password = String(body.password);
    if (password.length < 4) {
      return { valid: false, message: "Password must be at least 4 characters" };
    }
    patch.password = password;
  }

  if (Object.keys(patch).length === 0) {
    return { valid: false, message: "No fields to update" };
  }

  return { valid: true, patch };
}

export async function countAdminUsers(
  db: { collection: (name: string) => { countDocuments: Function } },
) {
  return db.collection("users").countDocuments({
    $or: [{ isAdminUser: true }, { mobileNumber: ADMIN_MOBILE_FALLBACK }],
  });
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}
