import { ObjectId } from "mongodb";

type OrderDoc = {
  _id?: ObjectId;
  orderId?: string;
  orderStatus?: string;
  userId?: string;
  addressData?: {
    name?: string;
    phone?: string;
    address?: string;
    latitude?: number | string;
    longitude?: number | string;
  };
  assignedDriver?: {
    driverId?: string;
    name?: string;
    phone?: string;
    assignedAt?: Date | string;
  };
  driverTrackingStatus?: string;
  amountPaid?: string | number;
  totalProductCount?: number;
  imgArr?: string[];
  cartData?: { cart?: { items?: unknown[] } };
  createdAt?: Date | string;
  updatedAt?: Date | string;
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

export function normalizeDriverOrder(order: OrderDoc) {
  const lat = parseFloat(String(order.addressData?.latitude ?? ""));
  const lng = parseFloat(String(order.addressData?.longitude ?? ""));

  return {
    _id: order._id?.toString() ?? "",
    orderId: String(order.orderId ?? ""),
    orderStatus: String(order.orderStatus ?? ""),
    driverTrackingStatus: order.driverTrackingStatus ?? null,
    customerName: order.addressData?.name ?? "",
    customerPhone: order.addressData?.phone ?? "",
    deliveryAddress: order.addressData?.address ?? "",
    latitude: Number.isFinite(lat) ? lat : null,
    longitude: Number.isFinite(lng) ? lng : null,
    amountPaid: order.amountPaid != null ? String(order.amountPaid) : undefined,
    totalProductCount: order.totalProductCount,
    itemCount: order.cartData?.cart?.items?.length ?? 0,
    imgArr: order.imgArr ?? [],
    assignedDriver: order.assignedDriver ?? null,
    createdAt: toIso(order.createdAt),
    updatedAt: toIso(order.updatedAt),
  };
}

export function buildDriverOrderIdFilter(id: string) {
  const trimmed = decodeURIComponent(String(id)).trim();
  const or: Record<string, unknown>[] = [{ orderId: trimmed }];
  if (ObjectId.isValid(trimmed)) {
    or.unshift({ _id: new ObjectId(trimmed) });
  }
  return { $or: or, isDeleted: { $ne: true } };
}

export async function findDriverOrder(
  db: { collection: (name: string) => { findOne: Function } },
  id: string,
) {
  return db.collection("orders").findOne(buildDriverOrderIdFilter(id));
}
