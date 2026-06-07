"use client";

import {
  DirectionsRenderer,
  GoogleMap,
  Marker,
  useJsApiLoader,
} from "@react-google-maps/api";
import { onValue, ref } from "firebase/database";
import { useEffect, useState, useRef } from "react";
import { database } from "../../lib/firebase";
import MockLocationSender from "./MockLocationSender";

type LocationEntry = {
  lat: number;
  lng: number;
  timestamp: number;
};

const containerStyle = {
  width: "100%",
  height: "60vh",
  borderRadius: "10px",
};

export default function DriverTracking({
  orderId,
  customerLocation,
}: {
  orderId: string;
  customerLocation: { lat: number; lng: number };
}) {
  console.log("orderId567890", orderId);
  console.log("customerLocation6789", customerLocation);
  const [latestLocation, setLatestLocation] = useState<LocationEntry | null>(
    null,
  );
  const [directions, setDirections] =
    useState<google.maps.DirectionsResult | null>(null);
  const previousLocationRef = useRef<LocationEntry | null>(null);
  const [rotation, setRotation] = useState<number>(0);
  const mapRef = useRef<google.maps.Map | null>(null);

  console.log("latestLocatione4567890-", latestLocation);

  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: "AIzaSyCY7OexW8I25uKjtJwqU1hAQZAZ4d8bnqQ",
  });

  const calculateBearing = (
    start: LocationEntry,
    end: LocationEntry,
  ): number => {
    const startLat = (start.lat * Math.PI) / 180;
    const startLng = (start.lng * Math.PI) / 180;
    const endLat = (end.lat * Math.PI) / 180;
    const endLng = (end.lng * Math.PI) / 180;

    const y = Math.sin(endLng - startLng) * Math.cos(endLat);
    const x =
      Math.cos(startLat) * Math.sin(endLat) -
      Math.sin(startLat) * Math.cos(endLat) * Math.cos(endLng - startLng);

    let bearing = (Math.atan2(y, x) * 180) / Math.PI;
    bearing = (bearing + 360) % 360;
    return bearing;
  };

  console.log("latestLocatione4567890-", latestLocation);
  console.log("customerLocation6789", customerLocation);

  useEffect(() => {
    if (!latestLocation || !customerLocation) return;

    const directionsService = new google.maps.DirectionsService();

    directionsService.route(
      {
        origin: latestLocation,
        destination: customerLocation,
        travelMode: google.maps.TravelMode.DRIVING,
      },
      (result, status) => {
        if (status === "OK" && result) {
          setDirections(result);
        } else {
          console.error("Directions request failed:", status);
        }
      },
    );
  }, [latestLocation, customerLocation]);

  useEffect(() => {
    if (!orderId) return;
    const locationRef = ref(database, `drivers/${orderId}/locations`);

    const unsubscribe = onValue(locationRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const locationArray: LocationEntry[] = Object.values(data);
        locationArray.sort((a, b) => b.timestamp - a.timestamp);
        const newLocation = locationArray[0];

        if (previousLocationRef.current) {
          const bearing = calculateBearing(
            previousLocationRef.current,
            newLocation,
          );
          setRotation(bearing);
        }

        previousLocationRef.current = newLocation;
        setLatestLocation(newLocation);

        if (mapRef.current) {
          mapRef.current.panTo(newLocation);
        }
      }
    });

    return () => {
      unsubscribe();
    };
  }, [orderId]);

  useEffect(() => {
    console.log("latestLocation", latestLocation, mapRef.current);
    if (!latestLocation || !mapRef.current) return;

    const intervalId = setInterval(() => {
      console.log("latestLocation", latestLocation);
      if (mapRef.current && latestLocation) {
        mapRef.current.panTo(latestLocation);
      }
    }, 5000);

    return () => {
      clearInterval(intervalId);
    };
  }, [latestLocation, mapRef.current]);

  return (
    <div>
      <MockLocationSender orderId={orderId} />
      {isLoaded && latestLocation ? (
        <GoogleMap
          mapContainerStyle={containerStyle}
          center={latestLocation}
          zoom={20}
          onLoad={(map) => {
            console.log("map", map);
            mapRef.current = map;
          }}
        >
          <Marker
            position={{ lat: latestLocation.lat, lng: latestLocation.lng }}
            icon={{
              path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
              scale: 5,
              rotation: rotation,
              fillColor: "#000",
              fillOpacity: 1,
              strokeWeight: 2,
              strokeColor: "#0390fc",
            }}
          />

          <Marker
            position={customerLocation}
            icon={{
              url: "./house.png",
              scaledSize: new window.google.maps.Size(40, 40),
            }}
          />

          {directions && (
            <DirectionsRenderer
              directions={directions}
              options={{
                suppressMarkers: true,
                polylineOptions: {
                  strokeColor: "#0390fc",
                  strokeOpacity: 0.8,
                  strokeWeight: 4,
                },
              }}
            />
          )}
        </GoogleMap>
      ) : (
        <div
          style={{ width: "100%", height: "60vh", borderRadius: "10px" }}
          className="flex items-center justify-center bg-gray-100"
        >
          <div className="relative w-20 h-20">
            <div className="absolute w-full h-full border-4 border-blue-500 rounded-full animate-ping opacity-75"></div>
            <div className="absolute w-full h-full border-4 border-blue-500 rounded-full animate-pulse"></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <svg
                className="w-8 h-8 text-blue-500 animate-bounce"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
