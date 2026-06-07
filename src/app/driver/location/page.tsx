"use client";
import React, { useState, useEffect, useRef } from "react";
type LocationState = {
  latitude: number | null;
  longitude: number | null;
};
const LocationTracker = () => {
  const [location, setLocation] = useState<LocationState>({
    latitude: null,
    longitude: null,
  });
  const [error, setError] = useState<string | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const intervalIdRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    const handleSuccess = (position: GeolocationPosition) => {
      if (position?.coords?.latitude) {
        sendDriverLocation({
          latitude: position?.coords?.latitude,
          longitude: position?.coords?.longitude,
        });
      }
      const { latitude, longitude } = position.coords;
      setLocation({ latitude, longitude });
    };
    const handleError = (geoError: GeolocationPositionError) => {
      setError(geoError.message);
    };
    const startTracking = () => {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(handleSuccess, handleError, {
          enableHighAccuracy: true,
          timeout: 5000,
          maximumAge: 0,
        });
        intervalIdRef.current = setInterval(() => {
          navigator.geolocation.getCurrentPosition(handleSuccess, handleError, {
            enableHighAccuracy: true,
            timeout: 5000,
            maximumAge: 0,
          });
        }, 2000);
      } else {
        setError("Geolocation is not supported by this browser.");
      }
    };
    const stopTracking = () => {
      if (intervalIdRef.current) {
        clearInterval(intervalIdRef.current);
        intervalIdRef.current = null;
      }
    };
    if (isTracking) {
      startTracking();
    } else {
      stopTracking();
    }
    return () => stopTracking();
  }, [isTracking]);
  const startLocation = () => {
    setIsTracking(true);
  };
  const stopLocation = () => {
    setIsTracking(false);
  };
  const sendDriverLocation = async (loc: {
    latitude: number;
    longitude: number;
  }) => {
    let data = await fetch("/api/socket", {
      method: "POST",
      headers: {
        Authorization: `Basic eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY2Y2ZmZTM1NzE0N2IxMWJjZGE5OTg0OSIsIm1vYmlsZU51bWJlciI6IjkxMTExMTExMTEiLCJpYXQiOjE3MjU4ODAzNjAsImV4cCI6MTcyNTk2Njc2MH0.8iK3Je-98GDGYAuR6kVsVqpLOmTEf7fJCt2gKnpgb3A`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        data: loc,
      }),
    });
    data = await data?.json();
    console.log("Location sent:", data);
  };
  return (
    <div>
      <h2>Real-Time Location</h2>
      {error ? (
        <p>Error: {error}</p>
      ) : (
        <div>
          <p>Latitude: {location.latitude || "Fetching..."}</p>
          <p>Longitude: {location.longitude || "Fetching..."}</p>
        </div>
      )}
      <button onClick={startLocation} disabled={isTracking}>
        Start Tracking
      </button>
      <button onClick={stopLocation} disabled={!isTracking}>
        Stop Tracking
      </button>
    </div>
  );
};
export default LocationTracker;
