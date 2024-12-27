import { isTokenVerified } from "@/json";
import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";
import {
  abortTransaction,
  commitTransaction,
  connectDB,
  getClient,
  startTransaction,
} from "../lib/dbconnection";
import { deleteImage, uploadImage } from "../lib/global";

export async function PUT(req: Request, res) {
  if (req.method !== "PUT") {
    return NextResponse.json(
      { message: "Method not allowed" },
      { status: 405 }
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
    const db = await connectDB(req);
    const user = await db
      .collection("users")
      .findOne({ _id: new ObjectId(_id) });

    if (!user) {
      return NextResponse.json({ message: "User not found" }, { status: 404 });
    }

    // Prepare an update object that only contains fields that are not null
    const updateData: any = {};

    if (name) {
      updateData.name = name;
    }
    if (khataUrl) {
      updateData.khataUrl = khataUrl;
    }

    // Handle image updates only if a new image is provided
    if (type && imageUrl) {
      const imageObject = {
        type: type,
        imageUrl: imageUrl,
      };

      // If a new image is provided, delete the old one
      if (user?.profileImage) {
        await deleteImage(user?.profileImage);
      }

      // Upload the new image and set the URL in the update data
      const data = await uploadImage(imageObject);
      updateData.profileImage = data;
    }
    console.log("uytdfghjkl", updateData);
    // Only proceed with update if there is data to update
    if (Object.keys(updateData).length > 0) {
      console.log("98765rtyuiop");
      await db
        .collection("users")
        .updateOne({ _id: new ObjectId(_id) }, { $set: updateData });
    }

    // Fetch the updated user data
    const updatedUserData = await db
      .collection("users")
      .findOne({ _id: new ObjectId(_id) });

    return NextResponse.json(
      {
        message: "User updated successfully",
        userData: updatedUserData,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const _id = searchParams.get("_id");

    if (!_id) {
      return NextResponse.json({ message: "Missing user ID" }, { status: 400 });
    }

    // Verify token or other authentication mechanisms
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

    return NextResponse.json(
      {
        message: "User fetched successfully",
        userData: user,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}

export async function DELETE(req) {
  let session;

  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");

    if (!userId || !ObjectId.isValid(userId)) {
      return NextResponse.json({ message: "Invalid input" }, { status: 400 });
    }

    // Verify token
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

    // Delete cart
    await db
      .collection("carts")
      .deleteOne({ userId: userObjectId }, { session });

    // Delete search history
    await db
      .collection("searchHistory")
      .deleteOne({ userId: userId }, { session });

    // Delete user addresses
    await db
      .collection("userAddresses")
      .deleteMany({ userId: userId }, { session });

    // Delete orders
    await db.collection("orders").deleteMany({ userId: userId }, { session });

    // Fetch user's profile image path from the database
    const userProfile = await db
      .collection("users")
      .findOne({ _id: userObjectId }, { session });
    const profileImage = userProfile?.profileImage;
    if (profileImage) {
      await deleteImage(profileImage);
    }

    // Delete user profile
    await db.collection("users").deleteOne({ _id: userObjectId }, { session });

    await commitTransaction(session);
    return NextResponse.json(
      { message: "Account deleted successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error deleting account:", error);
    await abortTransaction(session);
    return NextResponse.json(
      { error: "Failed to delete account. Please try again later." },
      { status: 500 }
    );
  }
}
