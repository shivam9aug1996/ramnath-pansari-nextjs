import DriverTracking from "../components/DriverTracking";

export default function Page({
  searchParams,
}: {
  searchParams: {
    orderId?: string;
  };
}) {
  const orderId = searchParams?.orderId?.trim();

  if (!orderId) {
    return (
      <div
        style={{
          padding: 16,
          fontFamily: "system-ui, sans-serif",
          color: "#666",
        }}
      >
        Missing order ID
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
      <DriverTracking orderId={orderId} embedded />
    </div>
  );
}
