import dynamic from "next/dynamic";

const AddressMap = dynamic(() => import("../components/AddressMap"), {
  ssr: false,
  loading: () => (
    <div
      style={{
        height: "100vh",
        width: "100%",
        backgroundColor: "#f0f0f0",
        borderRadius: "12px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: "18px",
        color: "#666",
      }}
    />
  )
});

export default function Page({ searchParams }: { searchParams: { lat?: string; lng?: string } }) {
  const lat = parseFloat(searchParams?.lat || "28.709560");
  const lng = parseFloat(searchParams?.lng || "77.651730");

  if (!lat || !lng) return <div>No lat or lng</div>;

  return (
    <AddressMap
      initialLat={lat}
      initialLng={lng}
    />
  );
}
