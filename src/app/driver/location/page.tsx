"use client";
import React, { useState, useEffect, useRef } from "react";

const LocationTracker = () => {
  const [location, setLocation] = useState({ latitude: null, longitude: null });
  const [error, setError] = useState(null);
  const [isTracking, setIsTracking] = useState(false);
  const intervalIdRef = useRef(null); // To store the interval ID

  useEffect(() => {
    const handleSuccess = (position) => {
      if (position?.coords?.latitude) {
        sendDriverLocation({
          latitude: position?.coords?.latitude,
          longitude: position?.coords?.longitude,
        });
      }
      const { latitude, longitude } = position.coords;
      setLocation({ latitude, longitude });
    };

    const handleError = (error) => {
      setError(error.message);
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
        }, 2000); // Update location every 2 seconds
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

    // Cleanup interval on unmount
    return () => stopTracking();
  }, [isTracking]); // Effect runs when `isTracking` changes

  const startLocation = () => {
    setIsTracking(true);
  };

  const stopLocation = () => {
    setIsTracking(false);
  };

  const sendDriverLocation = async (loc) => {
    let data = await fetch("/api/socket", {
      method: "POST",
      headers: {
        Authorization: `Basic eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY2Y2ZmZTM1NzE0N2IxMWJjZGE5OTg0OSIsIm1vYmlsZU51bWJlciI6IjkxMTExMTExMTEiLCJpYXQiOjE3MjU4ODAzNjAsImV4cCI6MTcyNTk2Njc2MH0.8iK3Je-98GDGYAuR6kVsVqpLOmTEf7fJCt2gKnpgb3A`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        data: location,
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

// "use client";
// import React, { useState, useEffect, useRef } from "react";

// const mockLocations = [
//   { latitude: 28.7096, longitude: 77.65171 },
//   { latitude: 28.70982, longitude: 77.65192 },
//   { latitude: 28.70961, longitude: 77.65225 },
//   { latitude: 28.71017, longitude: 77.65276 },
//   { latitude: 28.71038, longitude: 77.65294 },
//   { latitude: 28.71035, longitude: 77.65298 },
//   { latitude: 28.71067, longitude: 77.65328 },
//   { latitude: 28.71071, longitude: 77.65335 },
//   { latitude: 28.71074, longitude: 77.65338 },
//   { latitude: 28.71061, longitude: 77.65363 },
//   { latitude: 28.71027, longitude: 77.65436 },
//   { latitude: 28.71022, longitude: 77.65444 },
//   { latitude: 28.71008, longitude: 77.65465 },
//   { latitude: 28.70999, longitude: 77.6547 },
//   { latitude: 28.70979, longitude: 77.65475 },
//   { latitude: 28.70973, longitude: 77.65477 },
//   { latitude: 28.70964, longitude: 77.6548 },
//   { latitude: 28.7095, longitude: 77.65489 },
//   { latitude: 28.70947, longitude: 77.65493 },
//   { latitude: 28.70936, longitude: 77.6551 },
//   { latitude: 28.70888, longitude: 77.65587 },
//   { latitude: 28.70875, longitude: 77.65609 },
//   { latitude: 28.70847, longitude: 77.65651 },
//   { latitude: 28.70841, longitude: 77.65656 },
//   { latitude: 28.7086, longitude: 77.65759 },
//   { latitude: 28.70867, longitude: 77.65792 },
//   { latitude: 28.70874, longitude: 77.65825 },
//   { latitude: 28.70888, longitude: 77.65893 },
//   { latitude: 28.70896, longitude: 77.65931 },
//   { latitude: 28.70916, longitude: 77.6603 },
//   { latitude: 28.70925, longitude: 77.66075 },
//   { latitude: 28.70934, longitude: 77.6612 },
//   { latitude: 28.70945, longitude: 77.66172 },
//   { latitude: 28.70947, longitude: 77.6618 },
//   { latitude: 28.70972, longitude: 77.66278 },
//   { latitude: 28.70978, longitude: 77.66306 },
//   { latitude: 28.70983, longitude: 77.66325 },
//   { latitude: 28.71005, longitude: 77.66415 },
//   { latitude: 28.71034, longitude: 77.66531 },
//   { latitude: 28.71065, longitude: 77.66669 },
//   { latitude: 28.71071, longitude: 77.66695 },
//   { latitude: 28.7111, longitude: 77.66848 },
//   { latitude: 28.71127, longitude: 77.66914 },
//   { latitude: 28.71147, longitude: 77.66994 },
//   { latitude: 28.71181, longitude: 77.6713 },
//   { latitude: 28.71206, longitude: 77.67228 },
//   { latitude: 28.71264, longitude: 77.67456 },
//   { latitude: 28.71279, longitude: 77.67515 },
//   { latitude: 28.71329, longitude: 77.67488 },
//   { latitude: 28.71349, longitude: 77.67477 },
//   { latitude: 28.71361, longitude: 77.67472 },
//   { latitude: 28.71363, longitude: 77.67471 },
//   { latitude: 28.71367, longitude: 77.6747 },
//   { latitude: 28.71376, longitude: 77.67466 },
//   { latitude: 28.71381, longitude: 77.67465 },
//   { latitude: 28.71389, longitude: 77.67461 },
//   { latitude: 28.71407, longitude: 77.67448 },
//   { latitude: 28.71424, longitude: 77.6743 },
//   { latitude: 28.71432, longitude: 77.67422 },
//   { latitude: 28.71435, longitude: 77.6742 },
//   { latitude: 28.71452, longitude: 77.67404 },
//   { latitude: 28.71476, longitude: 77.67389 },
//   { latitude: 28.71548, longitude: 77.67357 },
//   { latitude: 28.71585, longitude: 77.67341 },
//   { latitude: 28.7194, longitude: 77.67184 },
//   { latitude: 28.71909, longitude: 77.67134 },
//   { latitude: 28.71903, longitude: 77.67123 },
//   { latitude: 28.719, longitude: 77.67114 },
//   { latitude: 28.71897, longitude: 77.671 },
//   { latitude: 28.71895, longitude: 77.67078 },
//   { latitude: 28.71895, longitude: 77.67046 },
//   { latitude: 28.71895, longitude: 77.67043 },
//   { latitude: 28.71891, longitude: 77.67022 },
//   { latitude: 28.71876, longitude: 77.66967 },
//   { latitude: 28.71863, longitude: 77.66925 },
//   { latitude: 28.7185, longitude: 77.66893 },
//   { latitude: 28.71846, longitude: 77.66876 },
//   { latitude: 28.71826, longitude: 77.66807 },
//   { latitude: 28.71805, longitude: 77.66734 },
//   { latitude: 28.71788, longitude: 77.66665 },
// ];

// const LocationTracker = () => {
//   const [location, setLocation] = useState({ latitude: null, longitude: null });
//   const [error, setError] = useState(null);
//   //const [index, setIndex] = useState(0);
//   const timerRef = useRef();

//   const [index, setIndex] = useState(-1);

//   useEffect(() => {
//     if (index >= 0) {
//       setLocation(mockLocations[index]);
//       sendDriverLocation(mockLocations[index]);
//     }
//   }, [index]);

//   const sendDriverLocation = async (loc) => {
//     try {
//       const response = await fetch("/api/socket", {
//         method: "POST",
//         headers: {
//           Authorization: `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY2Y2ZmZTM1NzE0N2IxMWJjZGE5OTg0OSIsIm1vYmlsZU51bWJlciI6IjkxMTExMTExMTEiLCJpYXQiOjE3MjU4ODYwODgsImV4cCI6MTcyNTk3MjQ4OH0.hxVCwAVMb0K5xLOvSGNLP8cjtafmOAPmd1T4dn8w-zw`,
//           "Content-Type": "application/json",
//         },
//         body: JSON.stringify({ data: loc }),
//       });
//       const data = await response.json();
//       console.log("Response data:", data);
//     } catch (error) {
//       console.error("Error sending location:", error);
//     }
//   };

//   return (
//     <div>
//       <h2>Real-Time Location</h2>
//       {error ? (
//         <p>Error: {error}</p>
//       ) : (
//         <div>
//           <p>Latitude: {location.latitude || "Fetching..."}</p>
//           <p>Longitude: {location.longitude || "Fetching..."}</p>
//         </div>
//       )}
//       <button onClick={() => setIndex((prev) => prev + 1)}>
//         Send Location
//       </button>
//     </div>
//   );
// };

// export default LocationTracker;
