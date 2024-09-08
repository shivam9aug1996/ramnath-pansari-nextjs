import { isTokenVerified } from "@/json";
import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";
import { connectDB } from "../lib/dbconnection";

export async function POST(req, res) {
  if (req.method !== "POST") {
    return NextResponse.json(
      { message: "Method not allowed" },
      { status: 405 }
    );
  }

  try {
    let { query, userId } = await req.json();

    if (!query || !userId) {
      return NextResponse.json(
        { message: "Missing required fields" },
        { status: 400 }
      );
    }
    query = query?.toLowerCase();
    const tokenVerificationResponse = await isTokenVerified(req);
    if (tokenVerificationResponse) {
      return tokenVerificationResponse;
    }

    const db = await connectDB(req);
    const searchHistoryCollection = db.collection("searchHistory");

    const existingUserHistory = await searchHistoryCollection.findOne({
      userId,
    });

    if (existingUserHistory) {
      // Remove the old query if it exists
      await searchHistoryCollection.updateOne(
        { userId },
        {
          $pull: {
            data: { query },
          },
        }
      );

      // If the document exists, push the new query to the data array
      await searchHistoryCollection.updateOne(
        { userId },
        {
          $push: {
            data: { _id: new ObjectId(), query, timestamp: new Date() },
          },
        }
      );

      // Limit the data array length to 5 queries
      await searchHistoryCollection.updateOne(
        { userId },
        {
          $push: { data: { $each: [], $slice: -5 } },
        }
      );
    } else {
      // Insert a new document with the userId and data array
      await searchHistoryCollection.insertOne({
        userId,
        data: [{ query, timestamp: new Date(), _id: new ObjectId() }],
      });
    }

    return NextResponse.json(
      { message: "Search query saved" },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}

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
    const searchHistoryCollection = db.collection("searchHistory");
    const userHistory = await searchHistoryCollection.findOne({ userId });

    if (!userHistory || !userHistory.data) {
      return NextResponse.json([], { status: 200 });
    }

    return NextResponse.json(userHistory.data, { status: 200 });
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}

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
    const id = searchParams.get("id");

    if (!userId || !id) {
      return NextResponse.json(
        { message: "Missing userId or id param" },
        { status: 400 }
      );
    }

    const tokenVerificationResponse = await isTokenVerified(req);
    if (tokenVerificationResponse) {
      return tokenVerificationResponse;
    }

    const db = await connectDB(req);
    const searchHistoryCollection = db.collection("searchHistory");

    // Remove the specific query from the data array
    await searchHistoryCollection.updateOne(
      { userId },
      { $pull: { data: { _id: new ObjectId(id) } } }
    );

    return NextResponse.json(
      { message: "Search query deleted" },
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
