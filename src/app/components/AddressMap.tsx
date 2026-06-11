import {
  fetchStaticMapDataUrl,
  getGoogleMapsApiKeyAddress,
} from "@/lib/googleMaps";
import AddressMapClient, {
  type AddressMapClientProps,
} from "./AddressMapClient";

export type AddressMapProps = Omit<
  AddressMapClientProps,
  "googleMapsApiKey" | "staticMapUrl"
>;

function MapUnavailable() {
  return (
    <div
      style={{
        padding: 16,
        fontFamily: "system-ui, sans-serif",
        color: "#666",
        fontSize: 14,
        textAlign: "center",
      }}
    >
      Map configuration unavailable
    </div>
  );
}

export default async function AddressMap(props: AddressMapProps) {
  const googleMapsApiKey = getGoogleMapsApiKeyAddress();
  if (!googleMapsApiKey) {
    return <MapUnavailable />;
  }

  let staticMapUrl: string | null = null;
  if (props.initialLat != null && props.initialLng != null) {
    staticMapUrl = await fetchStaticMapDataUrl(
      props.initialLat,
      props.initialLng,
      { width: 640, height: 640, zoom: 18 },
    );
  }

  return (
    <AddressMapClient
      {...props}
      googleMapsApiKey={googleMapsApiKey}
      staticMapUrl={staticMapUrl}
    />
  );
}
