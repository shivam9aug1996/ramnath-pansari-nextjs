import { isTokenVerified } from "@/json";
import { ObjectId } from "mongodb";
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "../lib/dbconnection";
import { asMongoUpdate } from "@/types/api";
export async function POST(req: NextRequest) {
  if (req.method !== "POST") {
    return NextResponse.json(
      { message: "Method not allowed" },
      { status: 405 },
    );
  }
  try {
    let { query, userId } = await req.json();
    if (!query || !userId) {
      return NextResponse.json(
        { message: "Missing required fields" },
        { status: 400 },
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
      await searchHistoryCollection.updateOne(
        { userId },
        asMongoUpdate({
          $pull: {
            data: { query },
          },
        }),
      );
      await searchHistoryCollection.updateOne(
        { userId },
        asMongoUpdate({
          $push: {
            data: { _id: new ObjectId(), query, timestamp: new Date() },
          },
        }),
      );
      await searchHistoryCollection.updateOne(
        { userId },
        asMongoUpdate({
          $push: { data: { $each: [], $slice: -5 } },
        }),
      );
    } else {
      await searchHistoryCollection.insertOne({
        userId,
        data: [{ query, timestamp: new Date(), _id: new ObjectId() }],
      });
    }
    return NextResponse.json(
      { message: "Search query saved" },
      { status: 201 },
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
  if (req.method !== "GET") {
    return NextResponse.json(
      { message: "Method not allowed" },
      { status: 405 },
    );
  }
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");
    if (!userId) {
      return NextResponse.json(
        { message: "Missing userId param" },
        { status: 400 },
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
    const userId = searchParams.get("userId");
    const id = searchParams.get("id");
    if (!userId || !id) {
      return NextResponse.json(
        { message: "Missing userId or id param" },
        { status: 400 },
      );
    }
    const tokenVerificationResponse = await isTokenVerified(req);
    if (tokenVerificationResponse) {
      return tokenVerificationResponse;
    }
    const db = await connectDB(req);
    const searchHistoryCollection = db.collection("searchHistory");
    await searchHistoryCollection.updateOne(
      { userId },
      asMongoUpdate({ $pull: { data: { _id: new ObjectId(id) } } }),
    );
    return NextResponse.json(
      { message: "Search query deleted" },
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
