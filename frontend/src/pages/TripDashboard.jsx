import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Users, ChevronRight } from 'lucide-react';
import api from '../services/api.js';
import useTripStore, { selectTravelers } from '../store/tripStore.js';
import useAuthStore from '../store/authStore.js';
import useSocket from '../hooks/useSocket.js';
import useGeolocation from '../hooks/useGeolocation.js';

import GoogleMapContainer from '../components/map/GoogleMapContainer.jsx';
import TopTripBar from '../components/common/TopTripBar.jsx';
import FloatingMapControls from '../components/map/FloatingMapControls.jsx';
import GroupDrawer from '../components/common/GroupDrawer.jsx';
import StopModal from '../components/stops/StopModal.jsx';
import AlertBanner from '../components/common/AlertBanner.jsx';
import DemoController from '../components/simulation/DemoController.jsx';

export function TripDashboard() {
  const { tripId } = useParams();
  const {
    trip,
    members,
    fetchTripDetails,
    isLoadingTrip,
    liveLocations,
    setDrawerOpen,
    setActiveDrawerTab
  } = useTripStore();

  const { user } = useAuthStore();
  const isDemoModeEnabled = import.meta.env.VITE_DEMO_MODE === 'true';
  const [showSimPanel, setShowSimPanel] = useState(true);

  // Hook real-time websocket and GPS tracking
  useSocket(tripId);
  useGeolocation(tripId);

  useEffect(() => {
    fetchTripDetails(tripId);
  }, [tripId]);

  const handleStartTrip = async () => {
    try {
      await api.startTrip(tripId);
      fetchTripDetails(tripId);
    } catch (err) {
      alert(err.message || 'Failed to start trip');
    }
  };

  const handleEndTrip = async () => {
    if (!window.confirm('Are you sure you want to complete this trip? Live convoy tracking will be marked completed.')) return;
    try {
      await api.endTrip(tripId);
      fetchTripDetails(tripId);
    } catch (err) {
      alert(err.message || 'Failed to end trip');
    }
  };

  if (isLoadingTrip || !trip) {
    return (
      <div className="h-[calc(100vh-4rem)] flex items-center justify-center bg-[#f8f9fa] text-[#5f6368]">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-4 border-[#1a73e8] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm font-medium text-[#202124]">Connecting to live convoy...</p>
        </div>
      </div>
    );
  }

  const travelers = selectTravelers(members, liveLocations, user?.id, trip?.destination);
  const leaderTraveler = travelers.find(t => t.isLeader);
  const arrivedCount = travelers.filter(t => t.status === 'ARRIVED').length;
  const movingCount = travelers.filter(t => t.status === 'MOVING' || t.status === 'REJOINED').length;
  const stoppedCount = travelers.filter(t => t.status === 'STOPPED' || t.status === 'POSSIBLE_STOP').length;
  const splitCount = travelers.filter(t => t.status === 'SPLIT' || t.status === 'FALLING_BEHIND').length;

  return (
    <div className="relative w-full h-[calc(100vh-3.5rem)] overflow-hidden bg-[#f1f3f4] select-none">
      {/* 1. HERO FULL-BLEED MAP VIEWPORT */}
      <div className="absolute inset-0 z-0 w-full h-full">
        <GoogleMapContainer />
      </div>

      {/* 2. FLOATING TOP SEARCH / ROUTE BAR */}
      <TopTripBar
        onStartTrip={handleStartTrip}
        onEndTrip={handleEndTrip}
      />

      {/* 3. FLOATING ACTIONABLE ALERTS */}
      <AlertBanner />

      {/* 4. POPOVER STOP DETAILS CARD */}
      <StopModal />

      {/* 5. ALL CONVOY ARRIVED CELEBRATION FLOATING PILL */}
      {arrivedCount === travelers.length && travelers.length > 0 && (
        <div className="absolute top-16 left-1/2 transform -translate-x-1/2 z-30 pointer-events-auto animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-[#137333] text-white shadow-xl text-xs font-bold border border-[#ceead6]">
            <span>🎉</span>
            <span>All travelers have reached {trip.destination || 'the destination'}! ({arrivedCount}/{travelers.length})</span>
          </div>
        </div>
      )}

      {/* 6. SLEEK BOTTOM CONVOY STATUS BAR (Google Maps style) */}
      <div className="absolute bottom-5 left-5 z-20 pointer-events-auto flex flex-col gap-2">
        <button
          onClick={() => {
            setActiveDrawerTab('MEMBERS');
            setDrawerOpen(true);
          }}
          className="flex items-center gap-3 px-5 py-3 rounded-[28px] bg-white shadow-[0_2px_4px_rgba(0,0,0,0.2)] hover:shadow-[0_4px_8px_rgba(0,0,0,0.15)] text-xs font-bold text-[#202124] transition-shadow min-w-[300px] max-w-[400px]"
        >
          <div className="flex items-center gap-1.5 text-[#1a73e8]">
            <Users className="w-4 h-4" />
            <span>{travelers.length} Travelers</span>
          </div>

          <div className="h-4 w-px bg-[#dadce0]" />

          <div className="flex items-center gap-2 flex-1 justify-center">
            {movingCount > 0 && (
              <span className="text-[#137333] flex items-center gap-1">
                <span>🟢</span>
                <span>{movingCount} Moving</span>
              </span>
            )}
            {stoppedCount > 0 && (
              <span className="text-[#d93025] flex items-center gap-1">
                <span>🔴</span>
                <span>{stoppedCount} Stopped</span>
              </span>
            )}
            {movingCount === 0 && stoppedCount === 0 && arrivedCount === 0 && (
              <span className="text-[#5f6368]">Standby</span>
            )}
          </div>
        </button>
      </div>

      {/* DEMO CONTROLLER - Centered at bottom */}
      {isDemoModeEnabled && showSimPanel && (
        <div className="absolute bottom-5 left-1/2 transform -translate-x-1/2 z-20 pointer-events-auto">
          <DemoController />
        </div>
      )}

      {/* 7. FLOATING GROUP MEMBERS & TIMELINE DRAWER / 3-STATE BOTTOM SHEET */}
      <GroupDrawer />

      {/* 8. FLOATING MAP ACTION CONTROLS (Right side) */}
      <FloatingMapControls
        showSimPanel={isDemoModeEnabled && showSimPanel}
        setShowSimPanel={setShowSimPanel}
      />
    </div>
  );
}

export default TripDashboard;

