import { isTokenVerified } from "@/json";
import { ObjectId } from "mongodb";
import { NextRequest, NextResponse } from "next/server";
import type { ClientSession } from "mongodb";
import {
  abortTransaction,
  commitTransaction,
  connectDB,
  getClient,
  startTransaction,
} from "../lib/dbconnection";
import { deleteImage, uploadImage } from "../lib/global";
export async function PUT(req: NextRequest) {
  if (req.method !== "PUT") {
    return NextResponse.json(
      { message: "Method not allowed" },
      { status: 405 },
    );
  }
  try {
    const formData = await req?.formData();
    const _id = formData?.get("_id");
    const name = formData?.get("name");
    const khataUrl = formData?.get("khataUrl");
    const type = formData.get(`images[type]`);
    const imageUrl = formData.get(`images[image]`);
    const response = await isTokenVerified(req);
    if (response) {
      return response;
    }
    console.log(_id);
    if (!_id || typeof _id !== "string") {
      return NextResponse.json({ message: "Invalid user ID" }, { status: 400 });
    }
    const db = await connectDB(req);
    const user = await db
      .collection("users")
      .findOne({ _id: new ObjectId(_id) });
    if (!user) {
      return NextResponse.json({ message: "User not found" }, { status: 404 });
    }
    const updateData: any = {};
    if (name) {
      updateData.name = name;
    }
    if (khataUrl) {
      updateData.khataUrl = khataUrl;
    }
    if (
      type &&
      imageUrl &&
      typeof type === "string" &&
      typeof imageUrl === "string"
    ) {
      const imageObject = {
        type: type,
        imageUrl: imageUrl,
      };
      if (user?.profileImage) {
        await deleteImage(user?.profileImage);
      }
      const data = await uploadImage(imageObject);
      updateData.profileImage = data;
    }
    console.log("uytdfghjkl", updateData);
    if (Object.keys(updateData).length > 0) {
      console.log("98765rtyuiop");
      await db
        .collection("users")
        .updateOne({ _id: new ObjectId(_id) }, { $set: updateData });
    }
    const updatedUserData = await db
      .collection("users")
      .findOne({ _id: new ObjectId(_id) });
    return NextResponse.json(
      {
        message: "User updated successfully",
        userData: updatedUserData,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 },
    );
  }
}
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const _id = searchParams.get("_id");
    if (!_id) {
      return NextResponse.json({ message: "Missing user ID" }, { status: 400 });
    }
    const response = await isTokenVerified(req);
    if (response) {
      return response;
    }
    const db = await connectDB(req);
    const user = await db
      .collection("users")
      .findOne({ _id: new ObjectId(_id) });
    if (!user) {
      return NextResponse.json({ message: "User not found" }, { status: 404 });
    }
    console.log("user", user);
    return NextResponse.json(
      {
        message: "User fetched successfully",
        userData: user,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 },
    );
  }
}
export async function DELETE(req: NextRequest) {
  let session: ClientSession | undefined;
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");
    if (!userId || !ObjectId.isValid(userId)) {
      return NextResponse.json({ message: "Invalid input" }, { status: 400 });
    }
    const tokenVerificationResponse = await isTokenVerified(req);
    if (tokenVerificationResponse) {
      return tokenVerificationResponse;
    }
    const client = await getClient();
    session = await startTransaction(client);
    const db = await connectDB(req);
    const userObjectId = new ObjectId(userId);
    const user = await db.collection("users").findOne({ _id: userObjectId });
    if (!user) {
      return NextResponse.json({ message: "User not found" }, { status: 404 });
    }
    await db
      .collection("carts")
      .deleteOne({ userId: userObjectId }, { session });
    await db
      .collection("searchHistory")
      .deleteOne({ userId: userId }, { session });
    await db
      .collection("userAddresses")
      .deleteMany({ userId: userId }, { session });
    await db.collection("orders").deleteMany({ userId: userId }, { session });
    const userProfile = await db
      .collection("users")
      .findOne({ _id: userObjectId }, { session });
    const profileImage = userProfile?.profileImage;
    if (profileImage) {
      await deleteImage(profileImage);
    }
    await db.collection("users").deleteOne({ _id: userObjectId }, { session });
    await db
      .collection("pushTokens")
      .deleteOne({ userId: userId }, { session });
    await commitTransaction(session);
    return NextResponse.json(
      { message: "Account deleted successfully" },
      { status: 200 },
    );
  } catch (error) {
    console.error("Error deleting account:", error);
    if (session) await abortTransaction(session);
    return NextResponse.json(
      { error: "Failed to delete account. Please try again later." },
      { status: 500 },
    );
  }
}
