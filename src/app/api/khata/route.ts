import { isTokenVerified } from "@/json";
import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";
import { connectDB } from "../lib/dbConnectionKhata";

export async function GET(req, res) {
  try {
    const { searchParams } = new URL(req.url);
    const searchQuery = searchParams.get("searchQuery");

    // let url = `https://bahi-khata.vercel.app/api/customerList/?businessId=6593bf2527ab5f761bb0bfd0&searchQuery=${mobileNumber}`;
    // let data = await fetch(url);
    // data = await data?.json();
    // console.log(data);
    console.log("hgfjkjhghjk", req);

    if (!searchQuery) {
      return NextResponse.json(
        { message: "Missing searchQuery" },
        { status: 400 }
      );
    }
    const db = await connectDB(req);
    const businessId = "672a685b9b186e432647660a";
    const page = parseInt(new URL(req.url)?.searchParams?.get("page") || "1");

    const limit = parseInt(
      new URL(req.url)?.searchParams?.get("limit") || "10"
    );
    const skip = (page - 1) * limit;

    console.log("jhgfghjhgfghjk", db);
    const business = await db
      .collection("businesses")
      .findOne({ _id: new ObjectId(businessId) });
    console.log("uytrdfghjhgfd", business);
    let customers;
    let totalCustomers;
    console.log("jhgfdfghjkl", searchQuery);
    customers = await db
      .collection("customers")
      .find({
        businessId,
        $or: [
          { name: { $regex: searchQuery, $options: "i" } },
          { mobileNumber: { $regex: searchQuery, $options: "i" } },
          // Case-insensitive search for customer name
          // Add more fields if needed for the search
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
        { status: 200 }
      );
    } else if (customers.length == 0) {
      return NextResponse.json(
        {
          url: null,
          message: "Only for regular customers",
          customers: 0,
        },
        { status: 200 }
      );
    } else {
      return NextResponse.json(
        {
          url: null,
          message: "Be more specific",
          customers: customers.length,
        },
        { status: 200 }
      );
    }
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
