import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";
import { connectDB } from "../lib/dbconnection";

export async function PUT(req, res) {
  if (req.method !== "PUT") {
    return NextResponse.json(
      { message: "Method not allowed" },
      { status: 405 }
    );
  }

  try {
    const { _id, name } = await req.json();

    if (!_id || !name) {
      return NextResponse.json(
        { message: "Missing user ID or name" },
        { status: 400 }
      );
    }

    const db = await connectDB(req);
    const user = await db
      .collection("users")
      .findOne({ _id: new ObjectId(_id) });
    console.log(user);
    if (!user) {
      return NextResponse.json({ message: "User not found" }, { status: 404 });
    }

    const updatedUser = await db
      .collection("users")
      .updateOne({ _id: new ObjectId(_id) }, { $set: { name } });
    console.log(updatedUser);
    // if (updatedUser.modifiedCount === 0) {
    //   return NextResponse.json(
    //     { message: "Failed to update user" },
    //     { status: 500 }
    //   );
    // }

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
