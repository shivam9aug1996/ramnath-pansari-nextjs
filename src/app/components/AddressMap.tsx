'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { GoogleMap, useJsApiLoader, Marker, InfoWindow, Autocomplete } from '@react-google-maps/api';

const containerStyle = {
  width: '100%',
  height: '100vh'
};

const defaultCenter = {
  lat: 40.749933,
  lng: -73.98633
};

const libraries: ("places")[] = ["places"];

interface AddressMapProps {
  initialLat?: number;
  initialLng?: number;
  initialAddress?: string;
  onLocationSelect?: (location: {
    lat: number;
    lng: number;
    address: string;
    name?: string;
  }) => void;
  currentLat?: number;
  currentLng?: number;
}

const AddressMap: React.FC<AddressMapProps> = ({
  initialLat,
  initialLng,
  initialAddress,
  onLocationSelect,
  currentLat,
  currentLng
}) => {
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [marker, setMarker] = useState<{ lat: number; lng: number } | null>(null);
  const [selectedPlace, setSelectedPlace] = useState<google.maps.places.PlaceResult | null>(null);
  const [autocomplete, setAutocomplete] = useState<google.maps.places.Autocomplete | null>(null);
  const [clickedLocation, setClickedLocation] = useState<{
    lat: number;
    lng: number;
    address: string;
  } | null>(null);
  const [mapCenter, setMapCenter] = useState(defaultCenter);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: 'AIzaSyAy7V6ckyc8nrtceWmTGSguRry4oxVPGBQ',
    libraries
  });

  useEffect(() => {
    if (isLoaded && initialLat && initialLng) {
      const lat = initialLat;
      const lng = initialLng;
      const location = { lat, lng };
      setMarker(location);
      setMapCenter(location);

      if (initialAddress && searchInputRef.current) {
        searchInputRef.current.value = initialAddress;
        setClickedLocation({ lat, lng, address: initialAddress });
      } else {
        const geocoder = new google.maps.Geocoder();
        geocoder.geocode({ location })
          .then((response) => {
            if (response.results[0]) {
              const address = response.results[0].formatted_address;
              setClickedLocation({ lat, lng, address });
              updateSearchInput(address);
            }
          })
          .catch(console.error);
      }
    }
  }, [isLoaded]); // only run once on load

  const onLoad = useCallback((mapInstance: google.maps.Map) => {
    setMap(mapInstance);
  }, []);

  const onUnmount = useCallback(() => {
    setMap(null);
  }, []);

  const updateSearchInput = (address: string) => {
    if (searchInputRef.current) {
      searchInputRef.current.value = address;
    }
  };

  const onPlaceChanged = () => {
    if (!autocomplete) return;

    const place = autocomplete.getPlace();
    if (!place.geometry?.location) {
      window.alert('No location details available');
      return;
    }

    const lat = place.geometry.location.lat();
    const lng = place.geometry.location.lng();
    const location = { lat, lng };

    setSelectedPlace(place);
    setClickedLocation({
      lat,
      lng,
      address: place.formatted_address || ''
    });
    setMarker(location);

    if (map) {
        map.panTo(location);
      
        // Only zoom in if current zoom is less than desired
        const currentZoom = map.getZoom() ?? 10;
        if (currentZoom < 18) {
          setTimeout(() => {
            map.setZoom(18);
          }, 300); // delay allows smoother pan before zoom
        }
      }
  };

  const onAutocompleteLoad = (autocompleteInstance: google.maps.places.Autocomplete) => {
    setAutocomplete(autocompleteInstance);
  };

  const onMapClick = useCallback(async (e: google.maps.MapMouseEvent) => {
    if (!e.latLng) return;

    const lat = e.latLng.lat();
    const lng = e.latLng.lng();
    const location = { lat, lng };
console.log("map34567876543", location);
    if (map) {
        map.panTo(location);
      
        const currentZoom = map.getZoom() ?? 10;
        if (currentZoom < 18) {
          setTimeout(() => {
            map.setZoom(18);
          }, 300);
        }
      }

    setMarker(location);
    setSelectedPlace(null);

    const geocoder = new google.maps.Geocoder();
    try {
      const response = await geocoder.geocode({ location });
      if (response.results[0]) {
        const address = response.results[0].formatted_address;
        setClickedLocation({ lat, lng, address });
        updateSearchInput(address);
      }
    } catch (err) {
      console.error('Geocoding error:', err);
    }
  }, [map]);

  const handleLocationSelect = () => {
    let selectedLocation;
    console.log("selectedPlace", JSON.stringify(clickedLocation));
    if (selectedPlace?.geometry?.location) {
      
      selectedLocation = {
        lat: selectedPlace.geometry.location.lat(),
        lng: selectedPlace.geometry.location.lng(),
        address: selectedPlace.formatted_address || '',
        name: selectedPlace.name || ''
      };
    } else if (clickedLocation) {
      selectedLocation = {
        ...clickedLocation,
        name: 'Selected Location'
      };
    }

    if (selectedLocation) {
      if (typeof window !== "undefined" && (window as any).ReactNativeWebView) {
        (window as any).ReactNativeWebView.postMessage(JSON.stringify(selectedLocation));
      }
     // onLocationSelect(selectedLocation);
    }
  };

  const handleClearSelection = () => {
    setSelectedPlace(null);
    setClickedLocation(null);
    setMarker(null);
    if (searchInputRef.current) {
      searchInputRef.current.value = '';
    }
  };

  if (!isLoaded) {
    return  <></>
  }

  return (
    <div style={{ position: 'relative', height: '100vh' }}>
      <div style={{
        position: 'absolute',
        top: '20px',
        left: '20px',
        right: '20px',
        zIndex: 1,
        backgroundColor: 'white',
        padding: '10px',
        borderRadius: '4px',
        boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px'
      }}>
        <div style={{ position: 'relative' }}>
          <Autocomplete
            onLoad={onAutocompleteLoad}
            onPlaceChanged={onPlaceChanged}
            options={{
              fields: ['formatted_address', 'geometry', 'name'],
              types: ['geocode', 'establishment']
            }}
          >
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search for a location"
              style={{
                width: '100%',
                height: '40px',
                padding: '0 35px 0 12px',
                borderRadius: '4px',
                border: '1px solid #ccc',
                fontSize: '14px',
                transition: 'all 0.3s ease'
              }}
            />
          </Autocomplete>
          {(selectedPlace || clickedLocation) && (
            <button
              onClick={handleClearSelection}
              style={{
                position: 'absolute',
                right: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '5px',
                color: '#666',
                width: '20px',
                height: '20px',
                zIndex: 2,
                transition: 'all 0.3s ease'
              }}
            >
              ✕
            </button>
          )}
        </div>
        <div style={{ fontSize: '14px', color: '#666' }}>
          Or click on the map to select a location
        </div>
      </div>

      <GoogleMap
       
        mapContainerStyle={containerStyle}
        center={mapCenter}
        zoom={18}
        onLoad={onLoad}
        onUnmount={onUnmount}
        onClick={onMapClick}
        options={{
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          gestureHandling: 'greedy',
          clickableIcons: false,
          maxZoom: 18,
          minZoom: 3
        }}
      >
        {marker && (
          <Marker
            position={marker}
            animation={google.maps.Animation.DROP}
          />
        )}

        {(selectedPlace || clickedLocation) && marker && (
          <InfoWindow
            position={marker}
            onCloseClick={handleClearSelection}
            options={{
              pixelOffset: new google.maps.Size(0, -30),
              maxWidth: 300,
              disableAutoPan: true
            }}
          >
            <div style={{ padding: '4px' }}>
              <div style={{ marginBottom: '8px' }}>
                <strong style={{ fontSize: '14px' }}>
                  {selectedPlace?.name || 'Selected Location'}
                </strong>
                <div style={{ fontSize: '13px', color: '#666', marginTop: '2px' }}>
                  {selectedPlace?.formatted_address || clickedLocation?.address}
                </div>
              </div>
              <button
                onClick={handleLocationSelect}
                style={{
                  padding: '6px 12px',
                  backgroundColor: '#4285F4',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '13px',
                  width: '100%',
                  transition: 'all 0.3s ease'
                }}
              >
                Select This Location
              </button>
            </div>
          </InfoWindow>
        )}
      </GoogleMap>
      <div
        style={{
          position: "absolute",
          bottom: "80px",
          right: "10px",
          zIndex: 10,
        }}
      >
        <button
          onClick={() => {
            if (!currentLat || !currentLng) return;
            const location = { lat: currentLat, lng: currentLng };
            setMarker(location);
            setMapCenter(location);

            const geocoder = new google.maps.Geocoder();
            geocoder
              .geocode({ location })
              .then((response) => {
                if (response.results[0]) {
                  const address = response.results[0].formatted_address;
                  setClickedLocation({ ...location, address });
                  updateSearchInput(address);
                }
              })
              .catch(console.error);
          }}
          className="current-location-button"
        >
          <p className="current-location-button-text">📍 Current Location</p>
        </button>
      </div>
    </div>
  );
};

export default AddressMap;
