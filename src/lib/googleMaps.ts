/** Server-only Google Maps JS API key (falls back to public env for local dev). */
export function getGoogleMapsApiKey(): string {
  return (
    process.env.GOOGLE_MAPS_API_KEY ??
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ??
    process.env.GEOCODING_API ??
    ""
  );
}

export function getStaticMapApiKey(): string {
  return (
    process.env.STATIC_MAP_API ??
    process.env.GOOGLE_MAPS_API_KEY ??
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ??
    ""
  );
}

type StaticMapOptions = {
  width?: number;
  height?: number;
  zoom?: number;
};

export function buildStaticMapUrl(
  lat: number,
  lng: number,
  options: StaticMapOptions = {},
): string | null {
  const apiKey = getStaticMapApiKey();
  if (!apiKey) return null;

  const width = options.width ?? 640;
  const height = options.height ?? 272;
  const zoom = options.zoom ?? 15;

  return (
    `https://maps.googleapis.com/maps/api/staticmap` +
    `?center=${lat},${lng}` +
    `&zoom=${zoom}` +
    `&size=${width}x${height}` +
    `&scale=2` +
    `&markers=color:green%7C${lat},${lng}` +
    `&key=${apiKey}`
  );
}

/** Fetches static map on the server and inlines as data URL (works in mobile WebViews). */
export async function fetchStaticMapDataUrl(
  lat: number,
  lng: number,
  options: StaticMapOptions = {},
): Promise<string | null> {
  const url = buildStaticMapUrl(lat, lng, options);
  if (!url) return null;

  try {
    const res = await fetch(url);
    if (!res.ok) return null;

    const contentType = res.headers.get("content-type") ?? "image/png";
    const buffer = Buffer.from(await res.arrayBuffer());
    return `data:${contentType};base64,${buffer.toString("base64")}`;
  } catch {
    return null;
  }
}
