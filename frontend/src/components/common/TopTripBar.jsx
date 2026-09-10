import React from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  Clock,
  Play,
  CheckCircle,
  Users,
  Navigation
} from 'lucide-react';
import useTripStore, { selectTravelers } from '../../store/tripStore.js';
import useAuthStore from '../../store/authStore.js';

export function TopTripBar({ onStartTrip, onEndTrip }) {
  const {
    trip,
    isOwner,
    groupEta,
    members,
    liveLocations,
    isDrawerOpen,
    setDrawerOpen,
    activeDrawerTab,
    setActiveDrawerTab,
    offlineQueueCount
  } = useTripStore();

  const { user } = useAuthStore();

  if (!trip) return null;

  const isActive = trip.status === 'ACTIVE';
  const travelers = selectTravelers(members, liveLocations, user?.id);
  const stoppedCount = travelers.filter(t => t.status === 'STOPPED' || t.status === 'POSSIBLE_STOP').length;
  const splitCount = travelers.filter(t => t.status === 'SPLIT' || t.status === 'FALLING_BEHIND').length;

  const handleToggleDrawer = (tab = 'MEMBERS') => {
    if (isDrawerOpen && activeDrawerTab === tab) {
      setDrawerOpen(false);
    } else {
      setActiveDrawerTab(tab);
      setDrawerOpen(true);
    }
  };

  return (
    <div className="absolute top-4 left-4 z-30 pointer-events-none flex items-center justify-between gap-3 max-w-[680px] w-[calc(100%-32px)]">
      {/* Sleek Compact Google Maps Navigation Bar */}
      <div className="pointer-events-auto flex items-center gap-2 bg-white p-1.5 rounded-[24px] shadow-[0_2px_4px_rgba(0,0,0,0.2)] hover:shadow-[0_4px_8px_rgba(0,0,0,0.15)] transition-shadow min-w-0 flex-1">
        {/* Back Button */}
        <Link
          to="/dashboard"
          title="Back to Dashboard"
          className="p-2 rounded-full text-[#5f6368] hover:text-[#202124] hover:bg-[#f1f3f4] transition-colors shrink-0"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>

        {/* Route Title & Status */}
        <div className="flex items-center gap-1.5 px-2 min-w-0 flex-1">
          <Navigation className="w-3.5 h-3.5 text-[#1a73e8] shrink-0 transform -rotate-45 hidden xs:block" />
          <span className="text-sm font-bold text-[#202124] truncate leading-tight">
            {trip.origin} → {trip.destination}
          </span>
          <span
            className={`hidden sm:inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase shrink-0 ${
              isActive ? 'text-[#137333]' : 'text-[#5f6368]'
            }`}
          >
            {isActive ? <span className="w-1.5 h-1.5 rounded-full bg-[#137333] animate-pulse"></span> : null}
            {isActive ? 'LIVE' : trip.status}
          </span>
          {offlineQueueCount > 0 && (
            <span
              title={`${offlineQueueCount} unsent location ping(s) saved locally`}
              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#fef7e0] border border-[#f9ab00] text-[#b06000] shrink-0"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[#f9ab00] animate-pulse" />
              Offline · {offlineQueueCount} queued
            </span>
          )}
        </div>

        {/* Clustered Group ETA */}
        <div className="hidden md:flex items-center gap-1.5 px-3 py-1 rounded-full text-xs shrink-0 mr-1 bg-white">
          <span className="text-[#5f6368] text-[10px] font-bold">ETA</span>
          <span className="font-mono font-bold text-[#1a73e8] text-sm leading-none">
            {groupEta?.formattedEta || '--:--'}
          </span>
          <Clock className="w-3.5 h-3.5 text-[#1a73e8] ml-0.5" />
        </div>

        {/* Owner Action Buttons */}
        {isOwner && trip.status === 'PLANNED' && (
          <button
            onClick={onStartTrip}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-[#1a73e8] hover:bg-[#1557d0] shadow-[0_1px_2px_rgba(0,0,0,0.15)] text-white font-bold text-xs transition-colors shrink-0 mr-1"
          >
            <Play className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Start</span>
          </button>
        )}

        {isOwner && isActive && (
          <button
            onClick={onEndTrip}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-white hover:bg-[#fce8e6] text-[#d93025] font-bold text-xs shadow-[0_1px_2px_rgba(0,0,0,0.15)] transition-colors shrink-0 mr-1"
          >
            <span className="hidden sm:inline">End Route</span>
          </button>
        )}
      </div>

      {/* Convoy Travelers Quick Trigger Pill (Top-Right) */}
      <div className="pointer-events-auto shrink-0 hidden md:block">
        <button
          onClick={() => handleToggleDrawer('MEMBERS')}
          className={`flex items-center gap-2.5 px-4 py-2 rounded-[24px] shadow-[0_2px_4px_rgba(0,0,0,0.2)] transition-shadow text-xs font-bold bg-white hover:shadow-[0_4px_8px_rgba(0,0,0,0.15)]`}
        >
          <div className="flex items-center -space-x-1.5">
            {travelers.slice(0, 3).map((t, i) => (
              <div key={t.id || i} className="w-5 h-5 rounded-full bg-[#1a73e8] border border-white text-white flex items-center justify-center text-[9px] relative z-10 shadow-sm">
                {t.name?.[0]?.toUpperCase() || '?'}
              </div>
            ))}
          </div>
          <span className="text-[#3c4043]">{travelers.length} Travelers</span>
        </button>
      </div>
    </div>
  );
}

export default TopTripBar;
