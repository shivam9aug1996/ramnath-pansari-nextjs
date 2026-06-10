import DriverTracking from "../components/DriverTracking";

export default function Page({
  searchParams,
}: {
  searchParams: {
    orderId?: string;
    lat?: string;
    lng?: string;
  };
}) {
  const orderId = searchParams?.orderId;
  const lat = parseFloat(searchParams?.lat || "");
  const lng = parseFloat(searchParams?.lng || "");

  if (!orderId || Number.isNaN(lat) || Number.isNaN(lng)) {
    return (
      <div
        style={{
          padding: 16,
          fontFamily: "system-ui, sans-serif",
          color: "#666",
        }}
      >
        Missing orderId or customer location
      </div>
    );
  }

  return (
    <div
      style={{
        margin: 0,
        padding: 0,
        background: "#fff",
        height: "324px",
        overflow: "hidden",
      }}
    >
      <DriverTracking
        orderId={orderId}
        customerLocation={{ lat, lng }}
        embedded
      />
    </div>
  );
}
