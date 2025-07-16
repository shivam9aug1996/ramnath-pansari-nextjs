import { NextResponse } from "next/server";

// Mock data for all tabs
const mockAllTabData = {
  personal: {
    firstName: "John",
    age: 25,
  },
  address: {
    city: "Mumbai",
    zip: 400001,
    country: "India",
  },
};

export async function GET() {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 800));
  
  return NextResponse.json(mockAllTabData, { status: 200 });
}

export async function POST(req: Request) {
  try {
    const data = await req.json();
    console.log("All tab data saved:", data);
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500));
    
    return NextResponse.json({ 
      message: "All data saved successfully",
      data 
    }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ 
      error: "Failed to save data" 
    }, { status: 500 });
  }
} 