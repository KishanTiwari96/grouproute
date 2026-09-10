import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { X, MapPin, Check, Loader2 } from 'lucide-react';

// Fix Leaflet default marker icon
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

function MapClickHandler({ setPosition, setAddress, setIsGeocoding }) {
  useMapEvents({
    click(e) {
      const { lat, lng } = e.latlng;
      setPosition([lat, lng]);
      setIsGeocoding(true);
      
      // Reverse Geocode
      fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`)
        .then(res => res.json())
        .then(data => {
          if (data && data.display_name) {
            setAddress(data.display_name);
          } else {
            setAddress(`${lat.toFixed(5)}, ${lng.toFixed(5)}`);
          }
        })
        .catch(err => {
          console.error("Reverse geocoding failed", err);
          setAddress(`${lat.toFixed(5)}, ${lng.toFixed(5)}`);
        })
        .finally(() => setIsGeocoding(false));
    },
  });
  return null;
}

export default function LocationPickerModal({ isOpen, onClose, onLocationSelected, defaultLocation }) {
  const [position, setPosition] = useState(null);
  const [address, setAddress] = useState('');
  const [isGeocoding, setIsGeocoding] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (defaultLocation && defaultLocation.lat && defaultLocation.lng) {
        setPosition([defaultLocation.lat, defaultLocation.lng]);
        setAddress(defaultLocation.address || '');
      } else {
        // Default to India Center if no location provided
        setPosition(null);
        setAddress('');
      }
    }
  }, [isOpen, defaultLocation]);

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (position) {
      onLocationSelected({
        lat: position[0],
        lng: position[1],
        address: address
      });
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl w-full max-w-3xl overflow-hidden shadow-2xl flex flex-col h-[80vh] max-h-[800px] animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#dadce0]">
          <div>
            <h2 className="text-xl font-bold text-[#202124]">Pick Location on Map</h2>
            <p className="text-sm text-[#5f6368]">Click anywhere on the map to drop a pin.</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-[#5f6368] hover:text-[#202124] hover:bg-[#f1f3f4] rounded-full transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Map Container */}
        <div className="flex-1 relative w-full bg-[#f8f9fa]">
          <MapContainer
            center={position || [22.0, 79.0]} // Default India center
            zoom={position ? 15 : 5}
            style={{ width: '100%', height: '100%' }}
            zoomControl={true}
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              maxZoom={19}
            />
            <MapClickHandler 
              setPosition={setPosition} 
              setAddress={setAddress} 
              setIsGeocoding={setIsGeocoding} 
            />
            {position && <Marker position={position} />}
          </MapContainer>
        </div>

        {/* Footer / Selected Address */}
        <div className="p-6 bg-white border-t border-[#dadce0]">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div className="flex-1">
              <label className="block text-xs font-bold text-[#5f6368] uppercase tracking-wider mb-2">Selected Location</label>
              <div className="flex items-start gap-3 p-3 bg-[#f8f9fa] border border-[#dadce0] rounded-xl">
                <MapPin className="w-5 h-5 text-[#1a73e8] shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  {isGeocoding ? (
                    <div className="flex items-center gap-2 text-[#5f6368]">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="text-sm font-medium">Finding address...</span>
                    </div>
                  ) : position ? (
                    <>
                      <p className="text-sm font-bold text-[#202124] break-words line-clamp-2">{address}</p>
                      <p className="text-xs text-[#5f6368] font-mono mt-1">{position[0].toFixed(5)}, {position[1].toFixed(5)}</p>
                    </>
                  ) : (
                    <p className="text-sm text-[#5f6368] italic">No location selected</p>
                  )}
                </div>
              </div>
            </div>
            
            <button
              onClick={handleConfirm}
              disabled={!position || isGeocoding}
              className="px-8 py-3.5 rounded-full bg-[#1a73e8] hover:bg-[#1557d0] text-white font-bold shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shrink-0 w-full sm:w-auto"
            >
              <Check className="w-5 h-5" />
              <span>Confirm Location</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
