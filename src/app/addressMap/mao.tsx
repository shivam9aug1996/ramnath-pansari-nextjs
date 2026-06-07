"use client";
import React, { useState, useCallback, useRef } from "react";
import {
  GoogleMap,
  useJsApiLoader,
  Marker,
  InfoWindow,
} from "@react-google-maps/api";
import { Autocomplete } from "@react-google-maps/api";
const containerStyle = {
  width: "100%",
  height: "100vh",
};
const center = {
  lat: 40.749933,
  lng: -73.98633,
};
const libraries: "places"[] = ["places"];
const AddressMap = () => {
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [marker, setMarker] = useState<google.maps.LatLng | null>(null);
  const [selectedPlace, setSelectedPlace] =
    useState<google.maps.places.PlaceResult | null>(null);
  const [autocomplete, setAutocomplete] =
    useState<google.maps.places.Autocomplete | null>(null);
  const [clickedLocation, setClickedLocation] = useState<{
    lat: number;
    lng: number;
    address: string;
  } | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const { isLoaded } = useJsApiLoader({
    id: "google-map-script",
    googleMapsApiKey: "AIzaSyAy7V6ckyc8nrtceWmTGSguRry4oxVPGBQ",
    libraries: libraries,
  });
  const onLoad = useCallback((map: google.maps.Map) => {
    setMap(map);
  }, []);
  const onUnmount = useCallback(() => {
    setMap(null);
  }, []);
  const onPlaceChanged = () => {
    if (autocomplete) {
      const place = autocomplete.getPlace();
      if (!place.geometry?.location) {
        window.alert("No location details available for this place.");
        setMarker(null);
        return;
      }
      const location = place.geometry.location;
      const lat = location.lat();
      const lng = location.lng();
      setSelectedPlace(place);
      setClickedLocation({
        lat,
        lng,
        address: place.formatted_address || "",
      });
      setMarker(location);
      map?.panTo(location);
      map?.setZoom(17);
    }
  };
  const onAutocompleteLoad = (
    autocomplete: google.maps.places.Autocomplete,
  ) => {
    setAutocomplete(autocomplete);
  };
  const updateSearchInput = (address: string) => {
    if (searchInputRef.current) {
      searchInputRef.current.value = address;
    }
  };
  const onMapClick = useCallback(async (e: google.maps.MapMouseEvent) => {
    if (e.latLng) {
      const lat = e.latLng.lat();
      const lng = e.latLng.lng();
      const location = new google.maps.LatLng(lat, lng);
      setMarker(location);
      setSelectedPlace(null);
      const geocoder = new google.maps.Geocoder();
      try {
        const response = await geocoder.geocode({ location: { lat, lng } });
        if (response.results[0]) {
          const address = response.results[0].formatted_address;
          setClickedLocation({
            lat,
            lng,
            address,
          });
          updateSearchInput(address);
        }
      } catch (error) {
        console.error("Geocoding error:", error);
      }
    }
  }, []);
  const handleLocationSelect = () => {
    let selectedLocation;
    if (selectedPlace && selectedPlace.geometry?.location) {
      selectedLocation = {
        lat: selectedPlace.geometry.location.lat(),
        lng: selectedPlace.geometry.location.lng(),
        address: selectedPlace.formatted_address || "",
        name: selectedPlace.name || "",
      };
    } else if (clickedLocation) {
      selectedLocation = {
        ...clickedLocation,
        name: "Selected Location",
      };
    }
    if (selectedLocation) {
      console.log("Selected Location:", selectedLocation);
      window.alert(`Location selected: ${selectedLocation.address}`);
    }
  };
  const handleClearSelection = () => {
    setSelectedPlace(null);
    setClickedLocation(null);
    setMarker(null);
    if (searchInputRef.current) {
      searchInputRef.current.value = "";
    }
  };
  if (!isLoaded) {
    return <div>Loading...</div>;
  }
  return (
    <div style={{ position: "relative", height: "100vh" }}>
      <div
        style={{
          position: "absolute",
          top: "20px",
          left: "20px",
          right: "20px",
          zIndex: 1,
          backgroundColor: "white",
          padding: "10px",
          borderRadius: "4px",
          boxShadow: "0 2px 6px rgba(0,0,0,0.3)",
          display: "flex",
          flexDirection: "column",
          gap: "10px",
        }}
      >
        <div style={{ position: "relative" }}>
          <Autocomplete
            onLoad={onAutocompleteLoad}
            onPlaceChanged={onPlaceChanged}
          >
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search for a location"
              style={{
                width: "100%",
                height: "40px",
                padding: "0 12px",
                borderRadius: "4px",
                border: "1px solid #ccc",
                fontSize: "14px",
              }}
            />
          </Autocomplete>
          {(selectedPlace || clickedLocation) && (
            <button
              onClick={handleClearSelection}
              style={{
                position: "absolute",
                right: "10px",
                top: "50%",
                transform: "translateY(-50%)",
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: "5px",
                color: "#666",
              }}
            >
              ✕
            </button>
          )}
        </div>
        <div style={{ fontSize: "14px", color: "#666" }}>
          Or click on the map to select a location
        </div>
      </div>

      <GoogleMap
        mapContainerStyle={containerStyle}
        center={center}
        zoom={13}
        onLoad={onLoad}
        onUnmount={onUnmount}
        onClick={onMapClick}
        options={{
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          gestureHandling: "greedy",
        }}
      >
        {marker && <Marker position={marker} />}

        {(selectedPlace || clickedLocation) && marker && (
          <InfoWindow position={marker} onCloseClick={handleClearSelection}>
            <div>
              <h3>{selectedPlace?.name || "Selected Location"}</h3>
              <p>
                {selectedPlace?.formatted_address || clickedLocation?.address}
              </p>
              <button
                onClick={handleLocationSelect}
                style={{
                  marginTop: "10px",
                  padding: "8px 16px",
                  backgroundColor: "#4285F4",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer",
                }}
              >
                Select This Location
              </button>
            </div>
          </InfoWindow>
        )}
      </GoogleMap>
    </div>
  );
};
export default AddressMap;
