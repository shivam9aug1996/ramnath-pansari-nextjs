import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { connectDB } from "@/app/api/lib/dbconnection";
import { requireAdmin } from "@/app/api/admin/requireAdmin";
import { OrderStatus } from "@/app/api/order/orderStatus";
import { asMongoUpdate } from "@/types/api";

type RouteContext = { params: Promise<{ id: string }> };

function buildError(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

function buildIdFilter(id: string) {
  const base: Record<string, unknown> = { isDeleted: { $ne: true } };
  const or: Record<string, unknown>[] = [{ orderId: id }];
  if (ObjectId.isValid(id)) {
    or.unshift({ _id: new ObjectId(id) });
  }
  return { $and: [base, { $or: or }] };
}

export async function POST(req: Request, context: RouteContext) {
  const authError = await requireAdmin(req);
  if (authError) return authError;

  try {
    const { id } = await context.params;
    const body = await req.json();
    const driverUserId = String(body?.driverUserId ?? "").trim();

    if (!driverUserId || !ObjectId.isValid(driverUserId)) {
      return buildError("VALIDATION", "Valid driver user id is required", 400);
    }

    const db = await connectDB(req);
    if (!db) {
      return buildError("INTERNAL", "Database connection failed", 500);
    }

    const driverUser = await db.collection("users").findOne({
      _id: new ObjectId(driverUserId),
      isDriverUser: true,
    });

    if (!driverUser) {
      return buildError("NOT_FOUND", "Driver user not found", 404);
    }

    const driverId =
      driverUser.driverId != null && String(driverUser.driverId).trim()
        ? String(driverUser.driverId)
        : driverUser._id.toString();

    const order = await db.collection("orders").findOne(buildIdFilter(id));
    if (!order) {
      return buildError("NOT_FOUND", "Order not found", 404);
    }

    const orderStatus = String(order.orderStatus ?? "").toLowerCase();
    if ([OrderStatus.DELIVERED, OrderStatus.CANCELED, OrderStatus.OUT_FOR_DELIVERY].includes(orderStatus as typeof OrderStatus.DELIVERED)) {
      return buildError(
        "BAD_REQUEST",
        `Cannot assign driver when order is ${orderStatus}`,
        400,
      );
    }

    const now = new Date();
    const driverName = String(driverUser.name ?? "Driver");
    const driverPhone = String(driverUser.mobileNumber ?? "");

    if (order.assignedDriver?.driverId === driverId) {
      return NextResponse.json(
        {
          message: "Driver already assigned",
          assignedDriver: order.assignedDriver,
        },
        { status: 200 },
      );
    }

    const updates: Record<string, unknown> = {
      $set: {
        assignedDriver: {
          driverId,
          driverUserId,
          name: driverName,
          phone: driverPhone,
          assignedAt: now,
        },
        driverTrackingStatus: "driver_assigned",
        updatedAt: now,
      },
    };

    if (order.assignedDriver) {
      updates.$push = {
        driverHistory: {
          driverId: order.assignedDriver.driverId,
          name: order.assignedDriver.name,
          phone: order.assignedDriver.phone,
          assignedAt: order.assignedDriver.assignedAt,
          unassignedAt: now,
          reason: "Reassigned",
        },
        driverTrackingHistory: {
          status: "unassigned",
          timestamp: now,
        },
      };
    } else {
      updates.$push = {
        driverTrackingHistory: {
          status: "driver_assigned",
          timestamp: now,
        },
      };
    }

    await db.collection("orders").updateOne({ _id: order._id }, asMongoUpdate(updates));

    return NextResponse.json(
      {
        message: "Driver assigned",
        assignedDriver: {
          driverId,
          driverUserId,
          name: driverName,
          phone: driverPhone,
          assignedAt: now.toISOString(),
        },
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("[admin/orders/:id/assign-driver] POST error:", error);
    return buildError("INTERNAL", "Failed to assign driver", 500);
  }
}
