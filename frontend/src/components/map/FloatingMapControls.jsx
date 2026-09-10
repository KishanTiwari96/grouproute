import React, { useState } from 'react';
import {
  Crosshair,
  Compass,
  Plus,
  Minus,
  Layers,
  Check,
  Sliders,
  Radio,
  MapPin,
  Users
} from 'lucide-react';
import useTripStore from '../../store/tripStore.js';
import useAuthStore from '../../store/authStore.js';

export function FloatingMapControls({ showSimPanel, setShowSimPanel }) {
  const {
    fitConvoy,
    focusLocation,
    liveLocations,
    layerVisibility,
    toggleLayer,
    isDrawerOpen
  } = useTripStore();
  const { user } = useAuthStore();

  const [isLayerMenuOpen, setIsLayerMenuOpen] = useState(false);

  // Center on current user location
  const handleLocateMe = () => {
    if (user?.id && liveLocations[user.id]?.latitude) {
      const loc = liveLocations[user.id];
      focusLocation(loc.latitude, loc.longitude, 16);
    } else {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            focusLocation(pos.coords.latitude, pos.coords.longitude, 16);
          },
          () => {
            fitConvoy();
          }
        );
      } else {
        fitConvoy();
      }
    }
  };

  const handleZoomIn = () => {
    focusLocation(undefined, undefined, 16);
  };

  const handleZoomOut = () => {
    focusLocation(undefined, undefined, 10);
  };

  return (
    <div className={`absolute bottom-22 sm:bottom-6 z-20 flex flex-col items-end gap-2 pointer-events-auto transition-all duration-300 ${isDrawerOpen ? 'right-4 md:right-[410px]' : 'right-4'}`}>
      {/* Layer Visibility Menu Popup */}
      {isLayerMenuOpen && (
        <div className="bg-white p-3 rounded-2xl shadow-[0_4px_12px_rgba(0,0,0,0.2)] mb-1 w-52 space-y-1.5 animate-in fade-in slide-in-from-bottom-2 duration-150 text-xs">
          <div className="flex items-center justify-between pb-1.5 border-b border-[#f1f3f4]">
            <span className="font-bold text-[#202124] uppercase tracking-wider text-[10px]">
              Map Layers & Overlay
            </span>
            <button
              onClick={() => setIsLayerMenuOpen(false)}
              className="text-[#5f6368] hover:text-[#202124] text-xs font-bold p-0.5"
            >
              ✕
            </button>
          </div>

          {/* Layer Toggles */}
          <button
            onClick={() => toggleLayer('route')}
            className="w-full flex items-center justify-between p-1.5 rounded-xl hover:bg-[#f1f3f4] transition-colors text-[#3c4043]"
          >
            <span className="flex items-center gap-2 font-medium">
              <Radio className="w-3.5 h-3.5 text-[#1a73e8]" />
              <span>Highway Route</span>
            </span>
            {layerVisibility?.route && <Check className="w-4 h-4 text-[#1e8e3e]" />}
          </button>

          <button
            onClick={() => toggleLayer('members')}
            className="w-full flex items-center justify-between p-1.5 rounded-xl hover:bg-[#f1f3f4] transition-colors text-[#3c4043]"
          >
            <span className="flex items-center gap-2 font-medium">
              <Users className="w-3.5 h-3.5 text-[#1e8e3e]" />
              <span>Traveler Markers</span>
            </span>
            {layerVisibility?.members && <Check className="w-4 h-4 text-[#1e8e3e]" />}
          </button>

          <button
            onClick={() => toggleLayer('stops')}
            className="w-full flex items-center justify-between p-1.5 rounded-xl hover:bg-[#f1f3f4] transition-colors text-[#3c4043]"
          >
            <span className="flex items-center gap-2 font-medium">
              <MapPin className="w-3.5 h-3.5 text-[#d93025]" />
              <span>Stop Markers</span>
            </span>
            {layerVisibility?.stops && <Check className="w-4 h-4 text-[#1e8e3e]" />}
          </button>

          {/* Petrol POI Layer */}
          <button
            onClick={() => toggleLayer('petrol')}
            className="w-full flex items-center justify-between p-1.5 rounded-xl hover:bg-[#f1f3f4] transition-colors text-[#3c4043]"
          >
            <span className="flex items-center gap-2 font-medium">
              <span>⛽</span>
              <span>Petrol Stations</span>
            </span>
            {layerVisibility?.petrol && <Check className="w-4 h-4 text-[#1e8e3e]" />}
          </button>

          {/* Hotels POI Layer */}
          <button
            onClick={() => toggleLayer('hotels')}
            className="w-full flex items-center justify-between p-1.5 rounded-xl hover:bg-[#f1f3f4] transition-colors text-[#3c4043]"
          >
            <span className="flex items-center gap-2 font-medium">
              <span>🏨</span>
              <span>Hotels & Lodges</span>
            </span>
            {layerVisibility?.hotels && <Check className="w-4 h-4 text-[#1e8e3e]" />}
          </button>

          {/* Simulation Toggle */}
          <button
            onClick={() => setShowSimPanel(!showSimPanel)}
            className="w-full flex items-center justify-between p-1.5 rounded-xl hover:bg-[#f1f3f4] transition-colors text-[#3c4043] pt-1.5 border-t border-[#f1f3f4]"
          >
            <span className="flex items-center gap-2 font-medium">
              <Sliders className="w-3.5 h-3.5 text-[#f9ab00]" />
              <span>Demo Controls</span>
            </span>
            {showSimPanel && <Check className="w-4 h-4 text-[#1e8e3e]" />}
          </button>
        </div>
      )}

      {/* Layer Button */}
      <button
        onClick={() => setIsLayerMenuOpen(!isLayerMenuOpen)}
        title="Map Layers"
        className={`w-10 h-10 rounded-full flex items-center justify-center shadow-[0_1px_4px_rgba(0,0,0,0.3)] transition-all ${
          isLayerMenuOpen
            ? 'bg-[#1a73e8] text-white'
            : 'bg-white text-[#5f6368] hover:text-[#202124]'
        }`}
      >
        <Layers className="w-5 h-5" />
      </button>

      {/* Fit Group Convoy Button */}
      <button
        onClick={fitConvoy}
        title="Fit All Convoy Members (Show Group)"
        className="w-10 h-10 rounded-full bg-white text-[#5f6368] hover:text-[#202124] shadow-[0_1px_4px_rgba(0,0,0,0.3)] flex items-center justify-center transition-all group"
      >
        <Compass className="w-5 h-5 group-hover:rotate-45 transition-transform" />
      </button>

      {/* Current Location Button */}
      <button
        onClick={handleLocateMe}
        title="Center on My Location"
        className="w-10 h-10 rounded-full bg-white text-[#5f6368] hover:text-[#202124] shadow-[0_1px_4px_rgba(0,0,0,0.3)] flex items-center justify-center transition-all"
      >
        <Crosshair className="w-5 h-5" />
      </button>

      {/* Zoom Controls Container */}
      <div className="bg-white shadow-[0_1px_4px_rgba(0,0,0,0.3)] rounded-[8px] overflow-hidden flex flex-col mt-2">
        <button
          onClick={handleZoomIn}
          title="Zoom In"
          className="w-10 h-10 flex items-center justify-center text-[#5f6368] hover:bg-[#f8f9fa] hover:text-[#202124] border-b border-[#f1f3f4] transition-colors"
        >
          <Plus className="w-5 h-5" />
        </button>
        <button
          onClick={handleZoomOut}
          title="Zoom Out"
          className="w-10 h-10 flex items-center justify-center text-[#5f6368] hover:bg-[#f8f9fa] hover:text-[#202124] transition-colors"
        >
          <Minus className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}

export default FloatingMapControls;
