import React from "react";
import DriverTracking from "../components/DriverTracking";
const page = ({
  searchParams,
}: {
  searchParams: {
    orderId: string;
    lat: string;
    lng: string;
  };
}) => {
  console.log(searchParams);
  const orderId = searchParams?.orderId;
  const lat = searchParams?.lat;
  const lng = searchParams?.lng;
  if (!orderId || !lat || !lng) {
    return <div>No orderId or lat or lng</div>;
  }
  return (
    <DriverTracking
      orderId={orderId}
      customerLocation={{ lat: parseFloat(lat), lng: parseFloat(lng) }}
    />
  );
};
export default page;
