import { ObjectId } from "mongodb";
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "../lib/dbConnectionKhata";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const searchQuery = searchParams.get("searchQuery");

    console.log("hgfjkjhghjk", req);

    if (!searchQuery) {
      return NextResponse.json(
        { message: "Missing searchQuery" },
        { status: 400 },
      );
    }
    const db = await connectDB(req);
    const businessId = "672a685b9b186e432647660a";

    console.log("jhgfghjhgfghjk", db);
    const business = await db
      .collection("businesses")
      .findOne({ _id: new ObjectId(businessId) });
    console.log("uytrdfghjhgfd", business);
    let customers;
    console.log("jhgfdfghjkl", searchQuery);
    customers = await db
      .collection("customers")
      .find({
        businessId,
        $or: [
          { name: { $regex: searchQuery, $options: "i" } },
          { mobileNumber: { $regex: searchQuery, $options: "i" } },
        ],
      })
      .toArray();

    console.log("jhgfdfghjhgf", customers);
    if (customers.length == 1) {
      const partyId = customers[0]?._id?.toString();
      return NextResponse.json(
        {
          url: `https://bahi-khata.vercel.app/mykhata?businessId=${businessId}&partyId=${partyId}&partyType=customer`,
          customers: 1,
        },
        { status: 200 },
      );
    } else if (customers.length == 0) {
      return NextResponse.json(
        {
          url: null,
          message: "Only for regular customers",
          customers: 0,
        },
        { status: 200 },
      );
    } else {
      return NextResponse.json(
        {
          url: null,
          message: "Be more specific",
          customers: customers.length,
        },
        { status: 200 },
      );
    }
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 },
    );
  }
}
