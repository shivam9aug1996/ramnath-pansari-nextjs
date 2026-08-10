import { ObjectId } from "mongodb";
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "../lib/dbconnection";
import { deleteImage, uploadImage1 } from "../lib/global";
import { asMongoUpdate } from "@/types/api";
import { requireSameUser } from "@/app/api/lib/requireAuth";
import { sanitizeAddressData } from "@/app/api/utils/secureCart";

const getGoogleImage = (address: {
  latitude?: number;
  longitude?: number;
  colonyArea?: string;
  city?: string;
  state?: string;
}) => {
  const apiKey = process.env.STATIC_MAP_API;
  let str = "";
  if (address?.latitude) {
    str = `&markers=color:red%7Clabel:A%7C${address?.latitude},${address?.longitude}`;
  }
  const mapImage = `https://maps.googleapis.com/maps/api/staticmap?center=${address?.colonyArea}+${address?.city}+${address?.state}${str}&zoom=13&size=300x150&key=${apiKey}`;
  return mapImage;
};

export async function POST(req: NextRequest) {
  if (req.method !== "POST") {
    return NextResponse.json(
      { message: "Method not allowed" },
      { status: 405 },
    );
  }

  try {
    const { address, userId: requestedUserId } = await req.json();

    if (!address || !requestedUserId) {
      return NextResponse.json(
        { message: "Missing required fields" },
        { status: 400 },
      );
    }

    const auth = await requireSameUser(req, requestedUserId);
    if (auth instanceof NextResponse) return auth;
    const userId = auth.userId;

    const sanitized = sanitizeAddressData(address);
    if (!sanitized) {
      return NextResponse.json(
        { message: "Invalid address" },
        { status: 400 },
      );
    }

    const db = await connectDB(req);
    const addressCollection = db.collection("userAddresses");

    const data = await uploadImage1(getGoogleImage(sanitized as never));

    await addressCollection.updateOne(
      { userId },
      asMongoUpdate({
        $push: {
          addresses: {
            _id: new ObjectId(),
            ...sanitized,
            timestamp: new Date(),
            mapImage: data,
          },
        },
      }),
      { upsert: true },
    );

    return NextResponse.json({ message: "Address added" }, { status: 201 });
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 },
    );
  }
}

export async function GET(req: NextRequest) {
  if (req.method !== "GET") {
    return NextResponse.json(
      { message: "Method not allowed" },
      { status: 405 },
    );
  }

  try {
    const { searchParams } = new URL(req.url);
    const requestedUserId = searchParams.get("userId");

    if (!requestedUserId) {
      return NextResponse.json(
        { message: "Missing userId param" },
        { status: 400 },
      );
    }

    const auth = await requireSameUser(req, requestedUserId);
    if (auth instanceof NextResponse) return auth;
    const userId = auth.userId;

    const db = await connectDB(req);
    const addressCollection = db.collection("userAddresses");
    const userAddresses = await addressCollection.findOne({ userId });

    if (!userAddresses || !userAddresses.addresses) {
      return NextResponse.json([], { status: 200 });
    }

    return NextResponse.json(userAddresses.addresses, { status: 200 });
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 },
    );
  }
}

export async function PUT(req: NextRequest) {
  if (req.method !== "PUT") {
    return NextResponse.json(
      { message: "Method not allowed" },
      { status: 405 },
    );
  }

  try {
    const { address, userId: requestedUserId, addressId } = await req.json();

    if (!address || !requestedUserId || !addressId) {
      return NextResponse.json(
        { message: "Missing required fields" },
        { status: 400 },
      );
    }

    const auth = await requireSameUser(req, requestedUserId);
    if (auth instanceof NextResponse) return auth;
    const userId = auth.userId;

    const sanitized = sanitizeAddressData(address);
    if (!sanitized) {
      return NextResponse.json(
        { message: "Invalid address" },
        { status: 400 },
      );
    }

    const db = await connectDB(req);
    const addressCollection = db.collection("userAddresses");

    const userAddress = await addressCollection.findOne(
      { userId, "addresses._id": new ObjectId(addressId) },
      { projection: { "addresses.$": 1 } },
    );
    const existingAddress = userAddress?.addresses?.[0];
    const existingMapImage = existingAddress?.mapImage;
    if (existingMapImage) {
      await deleteImage(existingMapImage);
    }
    const data = await uploadImage1(getGoogleImage(sanitized as never));

    await addressCollection.updateOne(
      { userId, "addresses._id": new ObjectId(addressId) },
      {
        $set: {
          "addresses.$": {
            ...sanitized,
            _id: new ObjectId(addressId),
            timestamp: new Date(),
            mapImage: data,
          },
        },
      },
    );

    return NextResponse.json({ message: "Address updated" }, { status: 200 });
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 },
    );
  }
}

export async function DELETE(req: NextRequest) {
  if (req.method !== "DELETE") {
    return NextResponse.json(
      { message: "Method not allowed" },
      { status: 405 },
    );
  }

  try {
    const { searchParams } = new URL(req.url);
    const requestedUserId = searchParams.get("userId");
    const addressId = searchParams.get("addressId");

    if (!requestedUserId || !addressId) {
      return NextResponse.json(
        { message: "Missing userId or addressId param" },
        { status: 400 },
      );
    }

    const auth = await requireSameUser(req, requestedUserId);
    if (auth instanceof NextResponse) return auth;
    const userId = auth.userId;

    const db = await connectDB(req);
    const addressCollection = db.collection("userAddresses");

    const userAddress = await addressCollection.findOne(
      { userId, "addresses._id": new ObjectId(addressId) },
      { projection: { "addresses.$": 1 } },
    );
    const existingAddress = userAddress?.addresses?.[0];
    const existingMapImage = existingAddress?.mapImage;
    if (existingMapImage) {
      await deleteImage(existingMapImage);
    }

    await addressCollection.updateOne(
      { userId },
      asMongoUpdate({ $pull: { addresses: { _id: new ObjectId(addressId) } } }),
    );

    return NextResponse.json({ message: "Address deleted" }, { status: 200 });
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 },
    );
  }
}
