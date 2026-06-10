import { fetchStaticMapDataUrl, getGoogleMapsApiKey } from "@/lib/googleMaps";
import { getTrackingOrder } from "@/lib/trackingOrder";
import DriverTrackingClient from "./DriverTrackingClient";

export type DriverTrackingProps = {
  orderId: string;
  embedded?: boolean;
};

function TrackingMessage({ message }: { message: string }) {
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
      {message}
    </div>
  );
}

export default async function DriverTracking({
  orderId,
  embedded = true,
}: DriverTrackingProps) {
  const googleMapsApiKey = getGoogleMapsApiKey();
  if (!googleMapsApiKey) {
    return <TrackingMessage message="Map configuration unavailable" />;
  }

  const orderResult = await getTrackingOrder(orderId);
  if (!orderResult.ok) {
    return <TrackingMessage message={orderResult.message} />;
  }

  const staticMapUrl = await fetchStaticMapDataUrl(
    orderResult.customerLocation.lat,
    orderResult.customerLocation.lng,
    { height: embedded ? 272 : 300 },
  );

  return (
    <DriverTrackingClient
      orderId={orderResult.orderId}
      orderStatus={orderResult.orderStatus}
      customerLocation={orderResult.customerLocation}
      embedded={embedded}
      googleMapsApiKey={googleMapsApiKey}
      staticMapUrl={staticMapUrl}
    />
  );
}
