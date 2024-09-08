import { isTokenVerified } from "@/json";
import { NextResponse } from "next/server";
type AddressComponents = {
  long_name: string;
  short_name: string;
  types: string[];
};

export async function GET(req, res) {
  try {
    const { searchParams } = new URL(req.url);
    const latitude = searchParams.get("latitude");
    const longitude = searchParams.get("longitude");
    if (!latitude || !longitude) {
      return NextResponse.json(
        { message: "latitude and longitude are required fields" },
        { status: 400 }
      );
    }
    const tokenVerificationResponse = await isTokenVerified(req);
    if (tokenVerificationResponse) {
      return tokenVerificationResponse;
    }

    const apiKey = "AIzaSyChU_p89k5voDYzgaFQcIu3gjH-4K6LBo4";
    const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${apiKey}`;

    const response = await fetch(url);
    const data = await response.json();

    if (data.status !== "OK") {
      let errorMessage = "Geocoding failed";
      switch (data.status) {
        case "ZERO_RESULTS":
          errorMessage = "No results found for the given location.";
          break;
        case "OVER_QUERY_LIMIT":
          errorMessage = "Quota exceeded for the API.";
          break;
        case "REQUEST_DENIED":
          errorMessage = "Request denied. Check API key or request parameters.";
          break;
        case "INVALID_REQUEST":
          errorMessage = "Invalid request. Check query parameters.";
          break;
        case "UNKNOWN_ERROR":
          errorMessage = "Unknown server error. Try again later.";
          break;
      }
      throw new Error(data.error_message || errorMessage);
    }

    const addressComponents =
      (data.results[0]?.address_components as AddressComponents[]) || [];

    const getComponent = (types: string[]): string | null => {
      const component = addressComponents.find((comp) =>
        types.every((type) => comp.types.includes(type))
      );
      return component?.long_name || null;
    };

    const city =
      getComponent(["locality"]) ||
      getComponent(["administrative_area_level_2"]) ||
      getComponent(["administrative_area_level_3"]);
    const state = getComponent(["administrative_area_level_1"]);
    const pincode = getComponent(["postal_code"]);
    const area =
      getComponent(["sublocality", "political"]) ||
      getComponent(["neighborhood", "political"]) ||
      getComponent(["locality"]);

    return NextResponse.json(
      {
        data: {
          city: city || "",
          state: state || "",
          pincode: pincode || "",
          area: area || "",
          latitude: latitude,
          longitude: longitude,
        },
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Error:", error);

    return NextResponse.json(
      { error: error?.message || "Error fetching location details" },
      { status: 500 }
    );
  }
}
