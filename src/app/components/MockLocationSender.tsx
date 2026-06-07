"use client";
import React, { useState } from "react";
import { ref, push } from "firebase/database";
import { database } from "../../lib/firebase";

const mockCoordinates = [
  { lat: 28.709753, lng: 77.651847 },
  { lat: 28.709857, lng: 77.651861 },
  { lat: 28.709937, lng: 77.651747 },
  { lat: 28.709972, lng: 77.651555 },
  { lat: 28.709857, lng: 77.651418 },
  { lat: 28.709759, lng: 77.651332 },
  { lat: 28.709587, lng: 77.651151 },
];

interface Props {
  orderId: string;
}

const MockLocationSender: React.FC<Props> = ({ orderId }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isSending, setIsSending] = useState(false);

  const handleSendLocation = async () => {
    if (currentIndex >= mockCoordinates.length) return;

    const location = mockCoordinates[currentIndex];
    const driverRef = ref(database, `drivers/${orderId}/locations`);

    await push(driverRef, {
      lat: location.lat,
      lng: location.lng,
      timestamp: Date.now(),
    });

    setCurrentIndex((prev) => prev + 1);
    setIsSending(true);

    if (currentIndex === mockCoordinates.length - 1) {
      setIsSending(false);
    }
  };

  const handleReset = async () => {
    const firstLocation = mockCoordinates[0];
    const driverRef = ref(database, `drivers/${orderId}/locations`);

    await push(driverRef, {
      lat: firstLocation.lat,
      lng: firstLocation.lng,
      timestamp: Date.now(),
    });

    setCurrentIndex(1);
    setIsSending(true);
  };

  return (
    <div>
      <h3>Send Mock Location for Order ID: {orderId}</h3>
      <p>
        Current index: {currentIndex} / {mockCoordinates.length}
      </p>

      <button
        onClick={handleSendLocation}
        disabled={currentIndex >= mockCoordinates.length}
      >
        {currentIndex >= mockCoordinates.length
          ? "All Locations Sent"
          : "Send Next Location"}
      </button>

      <button onClick={handleReset} style={{ marginLeft: 10 }}>
        Reset
      </button>

      {isSending && currentIndex <= mockCoordinates.length && (
        <p>Location {currentIndex} sent!</p>
      )}
    </div>
  );
};

export default MockLocationSender;
