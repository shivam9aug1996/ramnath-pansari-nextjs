import AddressMap from "../components/AddressMap";

export default function Page({
  searchParams,
}: {
  searchParams: {
    lat?: string;
    lng?: string;
    cLat?: string;
    cLng?: string;
  };
}) {
  const lat = parseFloat(searchParams?.lat || "28.709560");
  const lng = parseFloat(searchParams?.lng || "77.651730");
  const cLat = parseFloat(searchParams?.cLat || "28.709560");
  const cLng = parseFloat(searchParams?.cLng || "77.651730");

  if (Number.isNaN(lat) || Number.isNaN(lng)) {
    return <div>No lat or lng</div>;
  }

  return (
    <AddressMap
      initialLat={lat}
      initialLng={lng}
      currentLat={cLat}
      currentLng={cLng}
    />
  );
}
