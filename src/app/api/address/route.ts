import { isTokenVerified } from "@/json";
import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";
import { connectDB } from "../lib/dbconnection";
import crypto from "crypto";
import url from "url";
import { deleteImage, uploadImage, uploadImage1 } from "../lib/global";

const getGoogleImage = (address) => {
  const apiKey = "AIzaSyC7xZGaD-wIjGWpfrBuqf3XshCrLri4B0Q";
  const mapImage = `https://maps.googleapis.com/maps/api/staticmap?center=${address?.colonyArea}+${address?.city}+${address?.state}&zoom=13&size=300x150&key=${apiKey}`;
  return mapImage;
};

// POST - Add a new address for the user
export async function POST(req, res) {
  if (req.method !== "POST") {
    return NextResponse.json(
      { message: "Method not allowed" },
      { status: 405 }
    );
  }

  try {
    const { address, userId } = await req.json();
    console.log("8765ehjk", userId, address);

    if (!address || !userId) {
      return NextResponse.json(
        { message: "Missing required fields" },
        { status: 400 }
      );
    }

    const tokenVerificationResponse = await isTokenVerified(req);
    if (tokenVerificationResponse) {
      return tokenVerificationResponse;
    }

    const db = await connectDB(req);
    const addressCollection = db.collection("userAddresses");
    // await new Promise((res) => {
    //   setTimeout(() => {
    //     res("hi");
    //   }, 5000);
    // });

    // Insert the new address for the user
    const data = await uploadImage1(getGoogleImage(address));

    await addressCollection.updateOne(
      { userId },
      {
        $push: {
          addresses: {
            _id: new ObjectId(),
            ...address,
            timestamp: new Date(),
            mapImage: data,
          },
        },
      },
      { upsert: true }
    );

    return NextResponse.json({ message: "Address added" }, { status: 201 });
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}

// GET - Fetch all addresses for the user
export async function GET(req, res) {
  if (req.method !== "GET") {
    return NextResponse.json(
      { message: "Method not allowed" },
      { status: 405 }
    );
  }

  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json(
        { message: "Missing userId param" },
        { status: 400 }
      );
    }

    const tokenVerificationResponse = await isTokenVerified(req);
    if (tokenVerificationResponse) {
      return tokenVerificationResponse;
    }

    const db = await connectDB(req);
    const addressCollection = db.collection("userAddresses");
    const userAddresses = await addressCollection.findOne({ userId });

    if (!userAddresses || !userAddresses.addresses) {
      return NextResponse.json([], { status: 200 });
    }
    await new Promise((res) => {
      setTimeout(() => {
        res("hi");
      }, 3000);
    });
    //throw Error("hi");

    return NextResponse.json(userAddresses.addresses, { status: 200 });
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}

// PUT - Update a specific address for the user
export async function PUT(req, res) {
  if (req.method !== "PUT") {
    return NextResponse.json(
      { message: "Method not allowed" },
      { status: 405 }
    );
  }

  try {
    const { address, userId, addressId } = await req.json();

    if (!address || !userId || !addressId) {
      return NextResponse.json(
        { message: "Missing required fields" },
        { status: 400 }
      );
    }

    const tokenVerificationResponse = await isTokenVerified(req);
    if (tokenVerificationResponse) {
      return tokenVerificationResponse;
    }

    const db = await connectDB(req);
    const addressCollection = db.collection("userAddresses");

    const userAddress = await addressCollection.findOne(
      { userId, "addresses._id": new ObjectId(addressId) },
      { projection: { "addresses.$": 1 } }
    );
    const existingAddress = userAddress?.addresses?.[0];
    const existingMapImage = existingAddress?.mapImage;
    if (existingMapImage) {
      await deleteImage(existingMapImage);
    }
    console.log("76rdfghjkjgf", getGoogleImage(address));
    const data = await uploadImage1(getGoogleImage(address));
    console.log("iuytfghj", data);
    // Update the specific address for the user
    await addressCollection.updateOne(
      { userId, "addresses._id": new ObjectId(addressId) },
      {
        $set: {
          "addresses.$": {
            ...address,
            _id: new ObjectId(addressId),
            timestamp: new Date(),
            mapImage: data,
          },
        },
      }
    );

    return NextResponse.json({ message: "Address updated" }, { status: 200 });
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}

// DELETE - Remove a specific address for the user
export async function DELETE(req, res) {
  if (req.method !== "DELETE") {
    return NextResponse.json(
      { message: "Method not allowed" },
      { status: 405 }
    );
  }

  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");
    const addressId = searchParams.get("addressId");

    if (!userId || !addressId) {
      return NextResponse.json(
        { message: "Missing userId or addressId param" },
        { status: 400 }
      );
    }

    const tokenVerificationResponse = await isTokenVerified(req);
    if (tokenVerificationResponse) {
      return tokenVerificationResponse;
    }

    const db = await connectDB(req);
    const addressCollection = db.collection("userAddresses");

    const userAddress = await addressCollection.findOne(
      { userId, "addresses._id": new ObjectId(addressId) },
      { projection: { "addresses.$": 1 } }
    );
    const existingAddress = userAddress?.addresses?.[0];
    const existingMapImage = existingAddress?.mapImage;
    if (existingMapImage) {
      await deleteImage(existingMapImage);
    }

    // Remove the specific address from the addresses array
    await addressCollection.updateOne(
      { userId },
      { $pull: { addresses: { _id: new ObjectId(addressId) } } }
    );

    return NextResponse.json({ message: "Address deleted" }, { status: 200 });
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
