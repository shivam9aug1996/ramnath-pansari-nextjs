"use client";

import {
  DirectionsRenderer,
  GoogleMap,
  Marker,
  OverlayView,
  useJsApiLoader,
} from "@react-google-maps/api";
import { onValue, ref } from "firebase/database";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { database } from "../../lib/firebase";
import MockLocationSender from "./MockLocationSender";

type LocationEntry = {
  lat: number;
  lng: number;
  timestamp: number;
};

type LatLng = { lat: number; lng: number };

const EMBEDDED_MAP_HEIGHT = 272;
const STANDALONE_MAP_HEIGHT = 300;
const ROUTE_COLOR = "#1B7D3A";

const mapContainerStyle = (embedded: boolean) => ({
  width: "100%",
  height: embedded ? `${EMBEDDED_MAP_HEIGHT}px` : `${STANDALONE_MAP_HEIGHT}px`,
});

const mapOptions = {
  disableDefaultUI: true,
  zoomControl: false,
  mapTypeControl: false,
  streetViewControl: false,
  fullscreenControl: false,
  clickableIcons: false,
  gestureHandling: "greedy" as const,
  styles: [
    { featureType: "poi", elementType: "labels", stylers: [{ visibility: "off" }] },
    { featureType: "transit", stylers: [{ visibility: "off" }] },
  ],
};

function getDistanceMeters(a: LatLng, b: LatLng): number {
  const R = 6371000;
  const toRad = (v: number) => (v * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

/** Top-down bike.png faces north (0°); bearing is clockwise from north */
const BIKE_ICON_DEFAULT_HEADING = 0;
const BIKE_ICON_SIZE = 72;
const BIKE_ICON_SRC = "/bike.png?v=4";
const ROUTE_LOOKAHEAD_METERS = 30;
const rotatedBikeIconCache = new Map<string, string>();

function isBikeBackgroundPixel(r: number, g: number, b: number): boolean {
  if (r > 245 && g > 245 && b > 245) return true;
  if (r > 185 && g > 185 && b > 185 && Math.abs(r - g) < 14 && Math.abs(g - b) < 14) {
    return true;
  }
  return false;
}

function buildRotatedBikeIconUrl(rotationDeg: number): Promise<string> {
  const cacheKey = `${BIKE_ICON_SRC}:${Math.round(rotationDeg)}`;

  return new Promise((resolve) => {
    const cached = rotatedBikeIconCache.get(cacheKey);
    if (cached) {
      resolve(cached);
      return;
    }

    const img = new Image();
    img.onload = () => {
      const sourceCanvas = document.createElement("canvas");
      sourceCanvas.width = img.naturalWidth;
      sourceCanvas.height = img.naturalHeight;
      const sourceCtx = sourceCanvas.getContext("2d");
      if (!sourceCtx) {
        resolve(BIKE_ICON_SRC);
        return;
      }

      sourceCtx.drawImage(img, 0, 0);
      const imageData = sourceCtx.getImageData(
        0,
        0,
        sourceCanvas.width,
        sourceCanvas.height,
      );
      const { data, width, height } = imageData;

      for (let i = 0; i < data.length; i += 4) {
        if (isBikeBackgroundPixel(data[i], data[i + 1], data[i + 2])) {
          data[i + 3] = 0;
        }
      }
      sourceCtx.putImageData(imageData, 0, 0);

      let minX = width;
      let minY = height;
      let maxX = 0;
      let maxY = 0;

      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const alpha = data[(y * width + x) * 4 + 3];
          if (alpha > 24) {
            minX = Math.min(minX, x);
            minY = Math.min(minY, y);
            maxX = Math.max(maxX, x);
            maxY = Math.max(maxY, y);
          }
        }
      }

      if (maxX <= minX || maxY <= minY) {
        resolve(BIKE_ICON_SRC);
        return;
      }

      const cropW = maxX - minX + 1;
      const cropH = maxY - minY + 1;

      const canvas = document.createElement("canvas");
      canvas.width = BIKE_ICON_SIZE;
      canvas.height = BIKE_ICON_SIZE;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(BIKE_ICON_SRC);
        return;
      }

      ctx.clearRect(0, 0, BIKE_ICON_SIZE, BIKE_ICON_SIZE);
      ctx.translate(BIKE_ICON_SIZE / 2, BIKE_ICON_SIZE / 2);
      ctx.rotate((rotationDeg * Math.PI) / 180);

      const scale =
        Math.min(BIKE_ICON_SIZE / cropW, BIKE_ICON_SIZE / cropH) * 0.95;
      ctx.drawImage(
        sourceCanvas,
        minX,
        minY,
        cropW,
        cropH,
        (-cropW * scale) / 2,
        (-cropH * scale) / 2,
        cropW * scale,
        cropH * scale,
      );

      const url = canvas.toDataURL("image/png");
      rotatedBikeIconCache.set(cacheKey, url);
      resolve(url);
    };
    img.onerror = () => resolve(BIKE_ICON_SRC);
    img.src = BIKE_ICON_SRC;
  });
}

function getDetailedRoutePath(
  directions: google.maps.DirectionsResult | null,
): google.maps.LatLng[] {
  const route = directions?.routes?.[0];
  if (!route) return [];

  const points: google.maps.LatLng[] = [];
  for (const leg of route.legs ?? []) {
    for (const step of leg.steps ?? []) {
      step.path?.forEach((point, index) => {
        if (points.length === 0 || index > 0) {
          points.push(point);
        }
      });
    }
  }

  return points.length >= 2 ? points : (route.overview_path ?? []);
}

function calculateBearing(from: LatLng, to: LatLng): number {
  const startLat = (from.lat * Math.PI) / 180;
  const startLng = (from.lng * Math.PI) / 180;
  const endLat = (to.lat * Math.PI) / 180;
  const endLng = (to.lng * Math.PI) / 180;

  const y = Math.sin(endLng - startLng) * Math.cos(endLat);
  const x =
    Math.cos(startLat) * Math.sin(endLat) -
    Math.sin(startLat) * Math.cos(endLat) * Math.cos(endLng - startLng);

  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

function getBearingFromRoute(
  driver: LatLng,
  directions: google.maps.DirectionsResult | null,
): number | null {
  const path = getDetailedRoutePath(directions);
  if (path.length < 2) return null;

  let closestIndex = 0;
  let minDist = Infinity;

  path.forEach((point, index) => {
    const dist = getDistanceMeters(driver, {
      lat: point.lat(),
      lng: point.lng(),
    });
    if (dist < minDist) {
      minDist = dist;
      closestIndex = index;
    }
  });

  let accumulated = 0;
  let endIndex = closestIndex;

  while (endIndex < path.length - 1 && accumulated < ROUTE_LOOKAHEAD_METERS) {
    const from = path[endIndex];
    const to = path[endIndex + 1];
    accumulated += getDistanceMeters(
      { lat: from.lat(), lng: from.lng() },
      { lat: to.lat(), lng: to.lng() },
    );
    endIndex++;
  }

  if (endIndex === closestIndex) {
    endIndex = Math.min(closestIndex + 1, path.length - 1);
  }

  if (closestIndex === endIndex) {
    if (closestIndex === 0) return null;
    return calculateBearing(
      { lat: path[closestIndex - 1].lat(), lng: path[closestIndex - 1].lng() },
      { lat: path[closestIndex].lat(), lng: path[closestIndex].lng() },
    );
  }

  return calculateBearing(
    { lat: path[closestIndex].lat(), lng: path[closestIndex].lng() },
    { lat: path[endIndex].lat(), lng: path[endIndex].lng() },
  );
}

function getMinZoomForSeparation(separationMeters: number): number {
  if (separationMeters < 800) return 15;
  if (separationMeters < 2000) return 14;
  if (separationMeters < 5000) return 13;
  return 12;
}

function fitMapToTracking(
  map: google.maps.Map,
  driver: LatLng | null,
  customer: LatLng,
  directions: google.maps.DirectionsResult | null,
) {
  const bounds = new google.maps.LatLngBounds();
  bounds.extend(customer);
  if (driver) {
    bounds.extend(driver);
  }

  const separation = driver ? getDistanceMeters(driver, customer) : 0;

  // When far apart, fit driver + home only — full polyline pulls zoom too far out
  if (separation < 2000) {
    const path = directions?.routes?.[0]?.overview_path;
    if (path?.length) {
      path.forEach((point) => bounds.extend(point));
    }
  }

  if (!driver) {
    map.setCenter(customer);
    map.setZoom(15);
    return;
  }

  map.fitBounds(bounds, { top: 64, right: 40, bottom: 24, left: 40 });

  google.maps.event.addListenerOnce(map, "idle", () => {
    const zoom = map.getZoom();
    if (zoom === undefined) return;
    const minZoom = getMinZoomForSeparation(separation);
    if (zoom > 17) map.setZoom(17);
    if (zoom < minZoom) map.setZoom(minZoom);
  });
}

export type DriverTrackingClientProps = {
  orderId: string;
  customerLocation: LatLng;
  orderStatus?: string;
  embedded?: boolean;
  googleMapsApiKey: string;
  staticMapUrl?: string | null;
};

export default function DriverTrackingClient({
  orderId,
  customerLocation,
  orderStatus,
  embedded = true,
  googleMapsApiKey,
  staticMapUrl = null,
}: DriverTrackingClientProps) {
  const [latestLocation, setLatestLocation] = useState<LocationEntry | null>(
    null,
  );
  const [directions, setDirections] =
    useState<google.maps.DirectionsResult | null>(null);
  const [etaText, setEtaText] = useState<string | null>(null);
  const [distanceText, setDistanceText] = useState<string | null>(null);
  const [isWaitingForDriver, setIsWaitingForDriver] = useState(true);
  const [driverBearing, setDriverBearing] = useState(BIKE_ICON_DEFAULT_HEADING);
  const [bikeIconUrl, setBikeIconUrl] = useState<string | null>(null);

  const mapRef = useRef<google.maps.Map | null>(null);
  const lastDirectionsOriginRef = useRef<LatLng | null>(null);
  const previousDriverRef = useRef<LocationEntry | null>(null);
  const autoFollowRef = useRef(true);
  const isProgrammaticMoveRef = useRef(false);
  const hadDriverOnMapRef = useRef(false);
  const lastMovementBearingRef = useRef(BIKE_ICON_DEFAULT_HEADING);

  const [isAutoFollow, setIsAutoFollow] = useState(true);
  const [staticMapFailed, setStaticMapFailed] = useState(false);

  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey,
  });

  const driverPosition = useMemo(
    () =>
      latestLocation
        ? { lat: latestLocation.lat, lng: latestLocation.lng }
        : null,
    [latestLocation],
  );

  const applyAutoFollowViewport = useCallback(() => {
    if (!mapRef.current) return;
    isProgrammaticMoveRef.current = true;
    fitMapToTracking(
      mapRef.current,
      driverPosition,
      customerLocation,
      directions,
    );
    google.maps.event.addListenerOnce(mapRef.current, "idle", () => {
      isProgrammaticMoveRef.current = false;
    });
  }, [customerLocation, directions, driverPosition]);

  const panToDriver = useCallback((position: LatLng) => {
    if (!mapRef.current) return;
    isProgrammaticMoveRef.current = true;
    mapRef.current.panTo(position);
    google.maps.event.addListenerOnce(mapRef.current, "idle", () => {
      isProgrammaticMoveRef.current = false;
    });
  }, []);

  const handleRecenter = useCallback(() => {
    autoFollowRef.current = true;
    setIsAutoFollow(true);
    applyAutoFollowViewport();
  }, [applyAutoFollowViewport]);

  const handleMapLoad = useCallback(
    (map: google.maps.Map) => {
      mapRef.current = map;

      map.addListener("dragstart", () => {
        if (isProgrammaticMoveRef.current) return;
        autoFollowRef.current = false;
        setIsAutoFollow(false);
      });

      map.addListener("zoom_changed", () => {
        if (isProgrammaticMoveRef.current) return;
        autoFollowRef.current = false;
        setIsAutoFollow(false);
      });

      applyAutoFollowViewport();
    },
    [applyAutoFollowViewport],
  );

  const resolveDriverBearing = useCallback(
    (current: LocationEntry, route: google.maps.DirectionsResult | null) => {
      const currentLatLng = { lat: current.lat, lng: current.lng };
      const previous = previousDriverRef.current;

      const routeBearing = getBearingFromRoute(currentLatLng, route);
      if (routeBearing !== null) {
        lastMovementBearingRef.current = routeBearing;
        return routeBearing;
      }

      if (previous) {
        const moved = getDistanceMeters(previous, currentLatLng);
        if (moved > 8) {
          const bearing = calculateBearing(previous, currentLatLng);
          lastMovementBearingRef.current = bearing;
          return bearing;
        }
        return lastMovementBearingRef.current;
      }

      return calculateBearing(currentLatLng, customerLocation);
    },
    [customerLocation],
  );

  useEffect(() => {
    let cancelled = false;
    const rotationDeg = driverBearing - BIKE_ICON_DEFAULT_HEADING;

    buildRotatedBikeIconUrl(rotationDeg).then((url) => {
      if (!cancelled) setBikeIconUrl(url);
    });

    return () => {
      cancelled = true;
    };
  }, [driverBearing]);

  const fetchDirections = useCallback(
    (origin: LatLng) => {
      if (!window.google?.maps) return;

      const directionsService = new google.maps.DirectionsService();
      directionsService.route(
        {
          origin,
          destination: customerLocation,
          travelMode: google.maps.TravelMode.DRIVING,
        },
        (result, status) => {
          if (status !== "OK" || !result) {
            console.error("[DriverTracking] directions failed:", status);
            return;
          }

          setDirections(result);
          lastDirectionsOriginRef.current = origin;

          const leg = result.routes[0]?.legs[0];
          if (leg?.duration?.text) setEtaText(leg.duration.text);
          if (leg?.distance?.text) setDistanceText(leg.distance.text);

          requestAnimationFrame(() => {
            if (latestLocation) {
              setDriverBearing(resolveDriverBearing(latestLocation, result));
            }
            if (autoFollowRef.current && mapRef.current) {
              isProgrammaticMoveRef.current = true;
              fitMapToTracking(
                mapRef.current,
                origin,
                customerLocation,
                result,
              );
              google.maps.event.addListenerOnce(mapRef.current, "idle", () => {
                isProgrammaticMoveRef.current = false;
              });
            }
          });
        },
      );
    },
    [customerLocation, latestLocation, resolveDriverBearing],
  );

  useEffect(() => {
    if (!latestLocation || !directions) return;
    setDriverBearing((prev) => {
      const next = resolveDriverBearing(latestLocation, directions);
      return Number.isFinite(next) ? next : prev;
    });
  }, [directions, latestLocation, resolveDriverBearing]);

  useEffect(() => {
    if (!driverPosition) return;

    if (!hadDriverOnMapRef.current) {
      hadDriverOnMapRef.current = true;
      if (autoFollowRef.current) {
        applyAutoFollowViewport();
      }
      return;
    }

    const lastOrigin = lastDirectionsOriginRef.current;
    const shouldRefresh =
      !lastOrigin ||
      getDistanceMeters(lastOrigin, driverPosition) > 120;

    if (shouldRefresh) {
      fetchDirections(driverPosition);
      return;
    }

    if (autoFollowRef.current) {
      panToDriver(driverPosition);
    }
  }, [
    applyAutoFollowViewport,
    driverPosition,
    fetchDirections,
    panToDriver,
  ]);

  useEffect(() => {
    if (!orderId) return;

    const firebasePath = `drivers/${orderId}/locations`;
    const locationRef = ref(database, firebasePath);

    const unsubscribe = onValue(
      locationRef,
      (snapshot) => {
        const data = snapshot.val();
        if (!data) {
          setIsWaitingForDriver(true);
          return;
        }

        const locationArray: LocationEntry[] = Object.values(data);
        locationArray.sort((a, b) => b.timestamp - a.timestamp);
        const newLocation = locationArray[0];

        setDriverBearing((prev) => {
          const next = resolveDriverBearing(newLocation, directions);
          return Number.isFinite(next) ? next : prev;
        });
        previousDriverRef.current = newLocation;
        setLatestLocation(newLocation);
        setIsWaitingForDriver(false);
      },
      (error) => {
        console.error("[DriverTracking] Firebase error:", error);
      },
    );

    return () => unsubscribe();
  }, [directions, orderId, resolveDriverBearing]);

  const initialMapCenter = useMemo(
    () => ({ lat: customerLocation.lat, lng: customerLocation.lng }),
    [customerLocation.lat, customerLocation.lng],
  );

  return (
    <div
      style={{
        width: "100%",
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        background: embedded ? "#fff" : "#f8faf9",
        padding: 0,
        ...(embedded
          ? {
              height: `${EMBEDDED_MAP_HEIGHT + 52}px`,
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
            }
          : {}),
      }}
    >
      {embedded && <MockLocationSender orderId={orderId} compact />}

      <div
        style={{
          position: "relative",
          flex: embedded ? 1 : undefined,
          borderRadius: embedded ? 0 : "16px",
          overflow: "hidden",
          boxShadow: embedded ? "none" : "0 4px 20px rgba(0,0,0,0.08)",
          border: embedded ? "none" : "1px solid #e8ece9",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 12,
            left: 12,
            right: 12,
            zIndex: 2,
            background: "rgba(255,255,255,0.96)",
            borderRadius: "12px",
            padding: "10px 14px",
            boxShadow: "0 2px 12px rgba(0,0,0,0.1)",
            backdropFilter: "blur(8px)",
          }}
        >
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: "#1a1a1a",
              marginBottom: 2,
            }}
          >
            {isWaitingForDriver
              ? orderStatus === "confirmed"
                ? "Assigning delivery partner..."
                : "Waiting for driver location..."
              : "Delivery partner is on the way"}
          </div>
          <div style={{ fontSize: 12, color: "#5c6b63" }}>
            {isWaitingForDriver
              ? "Map will update when the driver starts moving"
              : etaText && distanceText
                ? `${etaText} away · ${distanceText}`
                : "Updating route..."}
          </div>
        </div>

        {!isAutoFollow && driverPosition && (
          <button
            type="button"
            onClick={handleRecenter}
            aria-label="Recenter map"
            style={{
              position: "absolute",
              bottom: 40,
              right: 12,
              zIndex: 3,
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "8px 12px",
              borderRadius: 20,
              border: "none",
              background: "#fff",
              boxShadow: "0 2px 10px rgba(0,0,0,0.15)",
              fontSize: 12,
              fontWeight: 600,
              color: "#1B7D3A",
              cursor: "pointer",
            }}
          >
            <span style={{ fontSize: 14, lineHeight: 1 }}>◎</span>
            Recenter
          </button>
        )}

        {!isLoaded ? (
          <div
            style={{
              ...mapContainerStyle(embedded),
              position: "relative",
              background: "#eef2ef",
              overflow: "hidden",
            }}
          >
            {staticMapUrl && !staticMapFailed ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={staticMapUrl}
                alt=""
                onError={() => setStaticMapFailed(true)}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  display: "block",
                }}
              />
            ) : null}
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background:
                  staticMapUrl && !staticMapFailed
                    ? "rgba(255,255,255,0.2)"
                    : "transparent",
              }}
            >
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: "50%",
                  border: "3px solid #d1ddd4",
                  borderTopColor: ROUTE_COLOR,
                  animation: "spin 0.8s linear infinite",
                }}
              />
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
          </div>
        ) : (
          <GoogleMap
            mapContainerStyle={mapContainerStyle(embedded)}
            center={initialMapCenter}
            zoom={14}
            options={mapOptions}
            onLoad={handleMapLoad}
          >
            {driverPosition && bikeIconUrl && (
              <OverlayView
                position={driverPosition}
                mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
                getPixelPositionOffset={() => ({
                  x: -BIKE_ICON_SIZE / 2,
                  y: -BIKE_ICON_SIZE / 2,
                })}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- Canvas data URL inside Google Maps OverlayView */}
                <img
                  src={bikeIconUrl}
                  alt=""
                  width={BIKE_ICON_SIZE}
                  height={BIKE_ICON_SIZE}
                  draggable={false}
                  style={{
                    display: "block",
                    pointerEvents: "none",
                    filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.35))",
                  }}
                />
              </OverlayView>
            )}

            <Marker
              position={customerLocation}
              icon={{
                url: "/house.png",
                scaledSize: new google.maps.Size(40, 40),
                anchor: new google.maps.Point(20, 36),
              }}
              zIndex={2}
            />

            {directions && driverPosition && (
              <DirectionsRenderer
                directions={directions}
                options={{
                  suppressMarkers: true,
                  preserveViewport: true,
                  polylineOptions: {
                    strokeColor: ROUTE_COLOR,
                    strokeOpacity: 0.95,
                    strokeWeight: 5,
                    zIndex: 1,
                  },
                }}
              />
            )}
          </GoogleMap>
        )}
      </div>

      {!embedded && (
        <details
          style={{
            marginTop: 8,
            fontSize: 12,
            color: "#6b7280",
          }}
          open
        >
          <summary style={{ cursor: "pointer", userSelect: "none" }}>
            Dev: mock driver location
          </summary>
          <div style={{ marginTop: 6 }}>
            <MockLocationSender orderId={orderId} />
          </div>
        </details>
      )}
    </div>
  );
}
