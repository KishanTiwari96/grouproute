import React from 'react';
import { X, MapPin, Clock, User, Navigation, Compass } from 'lucide-react';
import useTripStore from '../../store/tripStore.js';
import { formatTime, formatDuration } from '../../utils/formatters.js';

export function StopModal() {
  const { selectedStop, setSelectedStop, focusStop } = useTripStore();

  if (!selectedStop) return null;

  const isOngoing = !selectedStop.ended_at;

  const handleFocus = () => {
    focusStop(selectedStop);
    setSelectedStop(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#202124]/40 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-white border border-[#dadce0] rounded-3xl p-5 sm:p-6 shadow-2xl">
        {/* Close Button */}
        <button
          onClick={() => setSelectedStop(null)}
          className="absolute top-4 right-4 p-2 rounded-full text-[#5f6368] hover:text-[#202124] hover:bg-[#f1f3f4] transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3.5 mb-5">
          <div className="w-12 h-12 rounded-2xl bg-[#fce8e6] border border-[#fad2cf] flex items-center justify-center text-2xl shrink-0 shadow-xs">
            🛑
          </div>
          <div className="min-w-0 pr-6">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#c5221f] px-2 py-0.5 rounded-full bg-[#fce8e6] border border-[#fad2cf]">
              {isOngoing ? 'Active Stop' : 'Recorded Stop'}
            </span>
            <h3 className="text-base sm:text-lg font-bold text-[#202124] mt-1 leading-tight truncate">
              {selectedStop.location_name || 'Highway Rest Point'}
            </h3>
          </div>
        </div>

        {/* Details Grid */}
        <div className="space-y-3 bg-[#f8f9fa] p-4 rounded-2xl border border-[#dadce0]">
          <div className="flex items-center justify-between text-xs sm:text-sm">
            <span className="text-[#5f6368] flex items-center gap-2">
              <User className="w-4 h-4 text-[#1a73e8]" /> Traveler
            </span>
            <span className="font-semibold text-[#202124]">
              {selectedStop.user_name || 'Group Member'}
            </span>
          </div>

          <div className="flex items-center justify-between text-xs sm:text-sm">
            <span className="text-[#5f6368] flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#f9ab00]" /> Started At
            </span>
            <span className="font-mono text-[#3c4043]">
              {formatTime(selectedStop.started_at)}
            </span>
          </div>

          {selectedStop.ended_at && (
            <div className="flex items-center justify-between text-xs sm:text-sm">
              <span className="text-[#5f6368] flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#1e8e3e]" /> Resumed At
              </span>
              <span className="font-mono text-[#3c4043]">
                {formatTime(selectedStop.ended_at)}
              </span>
            </div>
          )}

          <div className="flex items-center justify-between text-xs sm:text-sm pt-2 border-t border-[#dadce0]">
            <span className="text-[#5f6368] font-medium">Stop Duration</span>
            <span className="font-bold text-[#d93025] font-mono text-sm sm:text-base">
              {isOngoing ? 'Currently Stopped' : formatDuration(selectedStop.duration_seconds)}
            </span>
          </div>

          {/* Nearby POIs */}
          {(selectedStop.metadata?.nearbyPetrol || selectedStop.metadata?.nearbyHotel) && (
            <div className="pt-2 border-t border-[#dadce0] space-y-1.5 text-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#5f6368]">
                Nearby Route Services
              </span>
              {selectedStop.metadata?.nearbyPetrol && (
                <div className="flex items-center justify-between bg-white p-2 rounded-xl border border-[#dadce0]">
                  <span className="flex items-center gap-1.5 font-medium text-[#202124]">
                    <span>⛽</span>
                    <span className="truncate">{selectedStop.metadata.nearbyPetrol.name}</span>
                  </span>
                  <span className="font-semibold text-[#1a73e8] shrink-0">
                    {selectedStop.metadata.nearbyPetrol.distanceText}
                  </span>
                </div>
              )}
              {selectedStop.metadata?.nearbyHotel && (
                <div className="flex items-center justify-between bg-white p-2 rounded-xl border border-[#dadce0]">
                  <span className="flex items-center gap-1.5 font-medium text-[#202124]">
                    <span>🏨</span>
                    <span className="truncate">{selectedStop.metadata.nearbyHotel.name}</span>
                  </span>
                  <span className="font-semibold text-[#1a73e8] shrink-0">
                    {selectedStop.metadata.nearbyHotel.distanceText}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* GPS Coordinates */}
        <div className="mt-3.5 flex items-center justify-between text-[11px] text-[#5f6368] px-1">
          <span className="flex items-center gap-1.5 font-mono">
            <MapPin className="w-3.5 h-3.5 text-[#80868b]" />
            {selectedStop.latitude?.toFixed(4)}°N, {selectedStop.longitude?.toFixed(4)}°E
          </span>
          <span>Auto-detected</span>
        </div>

        {/* Action Buttons */}
        <div className="mt-5 grid grid-cols-2 gap-2.5">
          <button
            onClick={handleFocus}
            className="flex items-center justify-center gap-1.5 py-2.5 rounded-full bg-[#1a73e8] hover:bg-[#1557d0] text-white font-bold text-xs shadow-sm transition-colors"
          >
            <Compass className="w-4 h-4" />
            <span>Center on Map</span>
          </button>

          <button
            onClick={() => setSelectedStop(null)}
            className="py-2.5 rounded-full bg-white hover:bg-[#f1f3f4] text-[#3c4043] border border-[#dadce0] font-semibold text-xs transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default StopModal;
