"use client";
import React, { useEffect, useState } from "react";
import { ref, push } from "firebase/database";
import { database } from "../../lib/firebase";

const LOG_PREFIX = "[MockLocationSender]";

const mockCoordinates = [
  { lat: 28.709612, lng: 77.651709 },
  { lat: 28.709821, lng: 77.651913 },
  { lat: 28.710004, lng: 77.651536 },
  { lat: 28.710526, lng: 77.651013 },
  { lat: 28.707797, lng: 77.648498 },
  { lat: 28.705218, lng: 77.639885 },
  { lat: 28.702922, lng: 77.627842 },
];

interface Props {
  orderId: string;
  compact?: boolean;
}

const MockLocationSender: React.FC<Props> = ({ orderId, compact = false }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isSending, setIsSending] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  const firebasePath = `drivers/${orderId}/locations`;

  useEffect(() => {
    console.log(`${LOG_PREFIX} mounted`, {
      orderId,
      firebasePath,
      totalMockPoints: mockCoordinates.length,
    });
  }, [orderId, firebasePath]);

  const handleSendLocation = async () => {
    if (currentIndex >= mockCoordinates.length) {
      console.warn(`${LOG_PREFIX} send skipped — all locations already sent`, {
        orderId,
        currentIndex,
      });
      return;
    }

    const location = mockCoordinates[currentIndex];
    const driverRef = ref(database, firebasePath);
    const payload = {
      lat: location.lat,
      lng: location.lng,
      timestamp: Date.now(),
    };

    console.log(`${LOG_PREFIX} sending location`, {
      orderId,
      firebasePath,
      index: currentIndex,
      payload,
    });

    try {
      const newRef = await push(driverRef, payload);
      console.log(`${LOG_PREFIX} location pushed successfully`, {
        orderId,
        firebaseKey: newRef.key,
        firebasePath: newRef.toString(),
        index: currentIndex,
      });
      setLastError(null);
      setCurrentIndex((prev) => prev + 1);
      setIsSending(true);

      if (currentIndex === mockCoordinates.length - 1) {
        setIsSending(false);
        console.log(`${LOG_PREFIX} all mock locations sent`, { orderId });
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown Firebase push error";
      console.error(`${LOG_PREFIX} push failed`, {
        orderId,
        firebasePath,
        index: currentIndex,
        error,
      });
      setLastError(message);
    }
  };

  const handleReset = async () => {
    const firstLocation = mockCoordinates[0];
    const driverRef = ref(database, firebasePath);
    const payload = {
      lat: firstLocation.lat,
      lng: firstLocation.lng,
      timestamp: Date.now(),
    };

    console.log(`${LOG_PREFIX} reset — sending first location`, {
      orderId,
      firebasePath,
      payload,
    });

    try {
      const newRef = await push(driverRef, payload);
      console.log(`${LOG_PREFIX} reset push successful`, {
        orderId,
        firebaseKey: newRef.key,
        firebasePath: newRef.toString(),
      });
      setLastError(null);
      setCurrentIndex(1);
      setIsSending(true);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown Firebase push error";
      console.error(`${LOG_PREFIX} reset push failed`, {
        orderId,
        firebasePath,
        error,
      });
      setLastError(message);
    }
  };

  if (compact) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          flexWrap: "wrap",
          padding: "8px 10px",
          background: "#f4f6f5",
          borderBottom: "1px solid #e3e8e5",
          fontSize: 12,
        }}
      >
        <span style={{ color: "#4b5563", fontWeight: 600 }}>Mock GPS</span>
        <span style={{ color: "#6b7280" }}>
          {currentIndex}/{mockCoordinates.length}
        </span>
        <button
          type="button"
          onClick={handleSendLocation}
          disabled={currentIndex >= mockCoordinates.length}
          style={{
            padding: "6px 10px",
            borderRadius: 8,
            border: "none",
            background: "#1B7D3A",
            color: "#fff",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          {currentIndex >= mockCoordinates.length ? "Done" : "Next"}
        </button>
        <button
          type="button"
          onClick={handleReset}
          style={{
            padding: "6px 10px",
            borderRadius: 8,
            border: "1px solid #cbd5d1",
            background: "#fff",
            cursor: "pointer",
          }}
        >
          Reset
        </button>
        {lastError && (
          <span style={{ color: "#dc2626", width: "100%" }}>{lastError}</span>
        )}
      </div>
    );
  }

  return (
    <div>
      <h3>Send Mock Location for Order ID: {orderId}</h3>
      <p>
        Current index: {currentIndex} / {mockCoordinates.length}
      </p>
      <p style={{ fontSize: 12, color: "#666" }}>Firebase path: {firebasePath}</p>

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

      {lastError && (
        <p style={{ color: "red", fontSize: 12 }}>Error: {lastError}</p>
      )}
    </div>
  );
};

export default MockLocationSender;
