import React, { useRef, useState, useEffect } from 'react';
import useTripStore, { selectTravelers } from '../../store/tripStore.js';
import useAuthStore from '../../store/authStore.js';
import { Navigation } from 'lucide-react';

export function CanvasMapVisualizer(props = {}) {
  const {
    trip,
    members,
    liveLocations,
    stops,
    pois: storePOIs,
    selectedPOI,
    setSelectedPOI,
    groupCenter,
    selectedMemberId,
    setSelectedMemberId,
    setSelectedStop,
    mapFocus,
    layerVisibility
  } = useTripStore();

  const { user: currentUser } = useAuthStore();
  const containerRef = useRef(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // References to maintain stable event listeners without thrashing
  const panRef = useRef(pan);
  panRef.current = pan;
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;

  const rawPois = props?.pois !== undefined ? props.pois : storePOIs;
  const pois = Array.isArray(rawPois) ? rawPois : [];

  const travelers = selectTravelers(members, liveLocations, currentUser?.id);

  // Map coordinate projection bounds (Standard Delhi -> Manali bounds or dynamic)
  const defaultBounds = {
    minLat: 28.4,
    maxLat: 32.5,
    minLng: 76.4,
    maxLng: 77.5
  };

  // Convert GPS (lat, lng) to canvas (x%, y%)
  const projectCoords = (lat, lng) => {
    const latSpan = defaultBounds.maxLat - defaultBounds.minLat;
    const lngSpan = defaultBounds.maxLng - defaultBounds.minLng;

    // Invert lat because higher lat is North (top of map)
    const yPct = ((defaultBounds.maxLat - lat) / latSpan) * 100;
    const xPct = ((lng - defaultBounds.minLng) / lngSpan) * 100;

    return {
      x: Math.max(5, Math.min(95, xPct)),
      y: Math.max(5, Math.min(95, yPct))
    };
  };

  // React to mapFocus triggers
  useEffect(() => {
    if (!mapFocus) return;

    if (mapFocus.fitGroup) {
      setZoom(1);
      setPan({ x: 0, y: 0 });
    } else if (mapFocus.lat && mapFocus.lng) {
      const proj = projectCoords(mapFocus.lat, mapFocus.lng);
      const targetZoom = mapFocus.zoom ? Math.min(2.5, mapFocus.zoom / 7) : 1.6;
      setZoom(targetZoom);
      const container = containerRef.current;
      if (container) {
        const width = container.clientWidth;
        const height = container.clientHeight;
        const targetX = (proj.x / 100) * width;
        const targetY = (proj.y / 100) * height;
        const panX = (width / 2 - targetX) * (targetZoom - 0.2);
        const panY = (height / 2 - targetY) * (targetZoom - 0.2);
        setPan({ x: panX, y: panY });
      }
    }
  }, [mapFocus]);

  // Stable non-passive wheel and touch event listeners attached to DOM container
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Non-passive wheel handler: safely calls preventDefault() to zoom without page scrolling
    const onWheel = (e) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.15 : 0.15;
      setZoom((prev) => Math.max(0.75, Math.min(3.5, prev + delta)));
    };

    let touchStartPan = null;
    let initialPinchDistance = null;
    let initialZoomOnPinch = 1;

    const onTouchStart = (e) => {
      if (e.touches.length === 1) {
        touchStartPan = {
          x: e.touches[0].clientX - panRef.current.x,
          y: e.touches[0].clientY - panRef.current.y
        };
      } else if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        initialPinchDistance = Math.hypot(dx, dy);
        initialZoomOnPinch = zoomRef.current;
      }
    };

    const onTouchMove = (e) => {
      if (e.touches.length === 1 && touchStartPan) {
        e.preventDefault();
        setPan({
          x: e.touches[0].clientX - touchStartPan.x,
          y: e.touches[0].clientY - touchStartPan.y
        });
      } else if (e.touches.length === 2 && initialPinchDistance) {
        e.preventDefault();
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const currentDistance = Math.hypot(dx, dy);
        if (initialPinchDistance > 0) {
          const scale = currentDistance / initialPinchDistance;
          setZoom(Math.max(0.75, Math.min(3.5, initialZoomOnPinch * scale)));
        }
      }
    };

    const onTouchEnd = () => {
      touchStartPan = null;
      initialPinchDistance = null;
    };

    container.addEventListener('wheel', onWheel, { passive: false });
    container.addEventListener('touchmove', onTouchMove, { passive: false });
    container.addEventListener('touchstart', onTouchStart, { passive: true });
    container.addEventListener('touchend', onTouchEnd, { passive: true });
    container.addEventListener('touchcancel', onTouchEnd, { passive: true });

    return () => {
      container.removeEventListener('wheel', onWheel, { passive: false });
      container.removeEventListener('touchmove', onTouchMove, { passive: false });
      container.removeEventListener('touchstart', onTouchStart, { passive: true });
      container.removeEventListener('touchend', onTouchEnd, { passive: true });
      container.removeEventListener('touchcancel', onTouchEnd, { passive: true });
    };
  }, []);

  // Desktop Mouse pan handlers
  const handleMouseDown = (e) => {
    if (e.button !== 0) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    });
  };

  const handleMouseUp = () => setIsDragging(false);

  // Highway Waypoints along Delhi-Manali NH44 / NH21 highway
  const routeWaypoints = [
    { name: 'Delhi', lat: 28.6315, lng: 77.2167 },
    { name: 'Murthal', lat: 29.0264, lng: 77.0700 },
    { name: 'Panipat', lat: 29.3909, lng: 76.9635 },
    { name: 'Karnal', lat: 29.6857, lng: 76.9905 },
    { name: 'Kurukshetra', lat: 29.9695, lng: 76.8783 },
    { name: 'Ambala', lat: 30.3782, lng: 76.7767 },
    { name: 'Chandigarh', lat: 30.7333, lng: 76.7794 },
    { name: 'Kiratpur', lat: 31.1812, lng: 76.5684 },
    { name: 'Bilaspur', lat: 31.3400, lng: 76.7600 },
    { name: 'Mandi', lat: 31.7087, lng: 76.9320 },
    { name: 'Kullu', lat: 31.9579, lng: 77.1095 },
    { name: 'Manali', lat: 32.2396, lng: 77.1887 }
  ];

  const originProj = projectCoords(trip?.origin_lat || 28.6315, trip?.origin_lng || 77.2167);
  const destProj = projectCoords(trip?.destination_lat || 32.2396, trip?.destination_lng || 77.1887);
  const centerProj = groupCenter && groupCenter.latitude ? projectCoords(groupCenter.latitude, groupCenter.longitude) : null;

  // Build SVG path string for route
  const pathD = routeWaypoints.reduce((acc, wp, idx) => {
    const pt = projectCoords(wp.lat, wp.lng);
    return `${acc} ${idx === 0 ? 'M' : 'L'} ${pt.x} ${pt.y}`;
  }, '');

  return (
    <div
      ref={containerRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      className="relative w-full h-full bg-[#f1f3f4] overflow-hidden select-none cursor-grab active:cursor-grabbing"
    >
      {/* Map Background Grid & Cartographic Canvas Layer */}
      <div
        className="absolute inset-0 transition-transform duration-100 ease-out"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: 'center center'
        }}
      >
        {/* Cartographic Coordinate Grid */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-40" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="light-carto-grid" width="80" height="80" patternUnits="userSpaceOnUse">
              <path d="M 80 0 L 0 0 0 80" fill="none" stroke="#dadce0" strokeWidth="0.8" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#light-carto-grid)" />
        </svg>

        {/* Dynamic Vector Route Layer */}
        {layerVisibility?.route && (
          <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
            {/* Route Casing */}
            <path
              d={pathD}
              fill="none"
              stroke="#8ab4f8"
              strokeWidth="3.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="opacity-70"
            />
            {/* Highway Route Polyline */}
            <path
              d={pathD}
              fill="none"
              stroke="#1a73e8"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Separation Alert Vectors (dotted line from split members to Group Centroid) */}
            {centerProj && travelers.map((t) => {
              if ((t.status === 'SPLIT' || t.status === 'FALLING_BEHIND') && t.latitude && t.longitude) {
                const memProj = projectCoords(t.latitude, t.longitude);
                return (
                  <g key={`split-line-${t.id}`}>
                    <line
                      x1={centerProj.x}
                      y1={centerProj.y}
                      x2={memProj.x}
                      y2={memProj.y}
                      stroke="#f9ab00"
                      strokeWidth="1.2"
                      strokeDasharray="1.5 1"
                      className="animate-pulse"
                    />
                  </g>
                );
              }
              return null;
            })}
          </svg>
        )}

        {/* Highway Milestone Labels */}
        {layerVisibility?.route && routeWaypoints.map((wp, idx) => {
          const pt = projectCoords(wp.lat, wp.lng);
          return (
            <div
              key={idx}
              className="absolute transform -translate-x-1/2 -translate-y-1/2 pointer-events-none flex items-center gap-1 opacity-75"
              style={{ left: `${pt.x}%`, top: `${pt.y}%` }}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[#5f6368]" />
              <span className="text-[10px] font-medium text-[#5f6368] whitespace-nowrap bg-white/90 px-1.5 py-0.2 rounded border border-[#dadce0] shadow-xs">
                {wp.name}
              </span>
            </div>
          );
        })}

        {/* Origin Pin */}
        <div
          className="absolute transform -translate-x-1/2 -translate-y-full z-10 pointer-events-auto"
          style={{ left: `${originProj.x}%`, top: `${originProj.y}%` }}
        >
          <div className="flex flex-col items-center">
            <span className="px-2.5 py-1 rounded-full bg-[#1e8e3e] text-white font-bold text-[10px] shadow-md flex items-center gap-1 border border-white">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
              Origin: {trip?.origin || 'Start'}
            </span>
            <div className="w-2 h-2 bg-[#1e8e3e] rotate-45 transform -translate-y-1 border-r border-b border-white" />
          </div>
        </div>

        {/* Destination Pin */}
        <div
          className="absolute transform -translate-x-1/2 -translate-y-full z-10 pointer-events-auto"
          style={{ left: `${destProj.x}%`, top: `${destProj.y}%` }}
        >
          <div className="flex flex-col items-center">
            <span className="px-2.5 py-1 rounded-full bg-[#d93025] text-white font-bold text-[10px] shadow-md flex items-center gap-1 border border-white">
              🏁 {trip?.destination || 'Destination'}
            </span>
            <div className="w-2 h-2 bg-[#d93025] rotate-45 transform -translate-y-1 border-r border-b border-white" />
          </div>
        </div>

        {/* Group Centroid Indicator */}
        {centerProj && (
          <div
            className="absolute transform -translate-x-1/2 -translate-y-1/2 z-15 pointer-events-none"
            style={{ left: `${centerProj.x}%`, top: `${centerProj.y}%` }}
          >
            <div className="relative flex items-center justify-center">
              <span className="w-12 h-12 rounded-full border border-[#1a73e8]/40 bg-[#1a73e8]/10 animate-ping-slow absolute" />
              <div className="w-4 h-4 rounded-full bg-[#1a73e8] border-2 border-white flex items-center justify-center shadow-md">
                <span className="w-1.5 h-1.5 rounded-full bg-white" />
              </div>
              <span className="absolute -bottom-4 text-[9px] font-bold text-[#1a73e8] bg-white px-2 py-0.2 rounded-full border border-[#1a73e8]/30 whitespace-nowrap shadow-xs">
                Convoy Hub
              </span>
            </div>
          </div>
        )}

        {/* Stop Markers */}
        {layerVisibility?.stops && stops.map((stop) => {
          if (!stop.latitude || !stop.longitude) return null;
          const proj = projectCoords(stop.latitude, stop.longitude);
          return (
            <div
              key={stop.id}
              onClick={(e) => {
                e.stopPropagation();
                setSelectedStop(stop);
              }}
              className="absolute transform -translate-x-1/2 -translate-y-1/2 z-20 cursor-pointer hover:scale-110 transition-transform pointer-events-auto"
              style={{ left: `${proj.x}%`, top: `${proj.y}%` }}
            >
              <div className="relative group flex flex-col items-center">
                <div className="w-7 h-7 rounded-full bg-[#d93025] border-2 border-white shadow-md flex items-center justify-center text-xs font-bold text-white">
                  🛑
                </div>
                <div className="absolute top-8 px-2 py-0.5 rounded-md bg-white border border-[#dadce0] text-[10px] font-bold text-[#d93025] shadow-xs whitespace-nowrap">
                  {stop.location_name || 'Stop'}
                </div>
              </div>
            </div>
          );
        })}

        {/* POI Markers: Petrol Stations ⛽ */}
        {layerVisibility?.petrol && (pois || []).filter(p => p.type === 'petrol' || p.type === 'FUEL').map((poi) => {
          if (!poi.latitude || !poi.longitude) return null;
          const proj = projectCoords(poi.latitude, poi.longitude);
          return (
            <div
              key={poi.id}
              onClick={(e) => {
                e.stopPropagation();
                setSelectedPOI(poi);
              }}
              className="absolute transform -translate-x-1/2 -translate-y-1/2 z-15 cursor-pointer hover:scale-115 transition-transform pointer-events-auto"
              style={{ left: `${proj.x}%`, top: `${proj.y}%` }}
              title={`${poi.name} (Petrol Station)`}
            >
              <div className="w-6 h-6 rounded-full bg-white border border-[#dadce0] shadow-sm flex items-center justify-center text-xs hover:border-[#1a73e8]">
                ⛽
              </div>
            </div>
          );
        })}

        {/* POI Markers: Hotels 🏨 */}
        {layerVisibility?.hotels && (pois || []).filter(p => p.type === 'hotel' || p.type === 'HOTEL').map((poi) => {
          if (!poi.latitude || !poi.longitude) return null;
          const proj = projectCoords(poi.latitude, poi.longitude);
          return (
            <div
              key={poi.id}
              onClick={(e) => {
                e.stopPropagation();
                setSelectedPOI(poi);
              }}
              className="absolute transform -translate-x-1/2 -translate-y-1/2 z-15 cursor-pointer hover:scale-115 transition-transform pointer-events-auto"
              style={{ left: `${proj.x}%`, top: `${proj.y}%` }}
              title={`${poi.name} (Hotel / Lodging)`}
            >
              <div className="w-6 h-6 rounded-full bg-white border border-[#dadce0] shadow-sm flex items-center justify-center text-xs hover:border-[#1a73e8]">
                🏨
              </div>
            </div>
          );
        })}

        {/* Live Active Member Markers (Every reporting traveler) */}
        {layerVisibility?.members && travelers.map((t) => {
          if (!t.latitude || !t.longitude || t.isSharingOff || t.status === 'OFFLINE') {
            return null;
          }

          const proj = projectCoords(t.latitude, t.longitude);
          const isSelected = selectedMemberId === t.id;
          const isStopped = t.status === 'STOPPED' || t.status === 'POSSIBLE_STOP';
          const isSplit = t.status === 'SPLIT' || t.status === 'FALLING_BEHIND';
          const isArrived = t.status === 'ARRIVED';
          const isLeader = t.isLeader;

          return (
            <div
              key={t.id}
              onClick={(e) => {
                e.stopPropagation();
                setSelectedMemberId(isSelected ? null : t.id);
              }}
              className={`absolute transform -translate-x-1/2 -translate-y-1/2 z-30 cursor-pointer transition-all duration-200 pointer-events-auto ${
                isSelected ? 'scale-125 z-40' : 'hover:scale-110'
              }`}
              style={{ left: `${proj.x}%`, top: `${proj.y}%` }}
            >
              <div className="relative flex flex-col items-center group">
                {/* Radar pulse ring for moving users */}
                {!isStopped && !isArrived && (
                  <span className="absolute -inset-1 rounded-full bg-[#1a73e8]/20 animate-radar pointer-events-none" />
                )}

                {/* Minimalist Google Maps Marker Pin */}
                <div
                  className={`relative w-8 h-8 rounded-full border-2 p-0.5 bg-white shadow-md transition-colors ${
                    isArrived
                      ? 'border-[#1e8e3e] ring-2 ring-[#1e8e3e]/30'
                      : isStopped
                      ? 'border-[#d93025] ring-2 ring-[#d93025]/30'
                      : isSplit
                      ? 'border-[#f9ab00] ring-2 ring-[#f9ab00]/35'
                      : isLeader
                      ? 'border-[#f9ab00] ring-2 ring-[#f9ab00]/40'
                      : t.isMe
                      ? 'border-[#1a73e8] ring-2 ring-[#1a73e8]/40'
                      : 'border-[#1e8e3e]'
                  }`}
                >
                  <img
                    src={t.profile_image}
                    alt={t.name}
                    className="w-full h-full rounded-full object-cover"
                  />

                  {/* Micro state indicator */}
                  <span
                    className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white flex items-center justify-center text-[7px] text-white font-extrabold ${
                      isArrived
                        ? 'bg-[#1e8e3e]'
                        : isStopped
                        ? 'bg-[#d93025]'
                        : isSplit
                        ? 'bg-[#f9ab00]'
                        : isLeader
                        ? 'bg-[#f9ab00]'
                        : t.isMe
                        ? 'bg-[#1a73e8]'
                        : 'bg-[#1e8e3e]'
                    }`}
                  >
                    {isArrived ? '✓' : isLeader ? '👑' : ''}
                  </span>
                </div>

                {/* Compact Name Tag */}
                <div className="mt-0.5 px-2 py-0.2 rounded-full bg-white/90 backdrop-blur-xs border border-[#dadce0] shadow-xs flex items-center gap-1 whitespace-nowrap">
                  {isLeader && <span className="text-[9px]">👑</span>}
                  <span className="text-[10px] font-bold text-[#202124]">
                    {t.name}
                  </span>
                  {t.isMe && (
                    <span className="text-[8px] uppercase font-extrabold px-1 rounded-full bg-[#1a73e8] text-white">
                      YOU
                    </span>
                  )}
                  {isArrived && (
                    <span className="text-[8px] font-bold text-[#137333]">
                      ✓ Arrived
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* PROGRESSIVE DISCLOSURE: FLOATING SELECTED TRAVELER CARD (Bottom-Left) */}
      {selectedMemberId && (() => {
        const sel = travelers.find(t => t.id === selectedMemberId);
        if (!sel) return null;

        const isStopped = sel.status === 'STOPPED' || sel.status === 'POSSIBLE_STOP';
        const isSplit = sel.status === 'SPLIT' || sel.status === 'FALLING_BEHIND';
        const isArrived = sel.status === 'ARRIVED';
        const isLeader = sel.isLeader;

        return (
          <div className="absolute bottom-22 sm:bottom-6 left-3 sm:left-4 z-40 max-w-[calc(100vw-24px)] sm:max-w-xs w-full bg-white/95 backdrop-blur-md border border-[#dadce0] p-3 rounded-3xl shadow-xl space-y-2 animate-in fade-in slide-in-from-bottom-2 duration-150 pointer-events-auto text-xs">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <img
                  src={sel.profile_image}
                  alt={sel.name}
                  className="w-9 h-9 rounded-full bg-[#f1f3f4] border border-[#dadce0] object-cover"
                />
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <h4 className="text-xs font-bold text-[#202124] truncate">{sel.name}</h4>
                    {isLeader && (
                      <span className="text-[9px] font-extrabold px-1.5 py-0.2 rounded-full bg-[#fef7e0] text-[#b06000] border border-[#feefc3]">
                        👑 LEADER
                      </span>
                    )}
                    {sel.isMe && (
                      <span className="text-[8px] font-extrabold uppercase px-1.5 py-0.2 rounded-full bg-[#1a73e8] text-white">
                        YOU
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-[#5f6368] truncate font-medium">
                    {sel.locationName}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setSelectedMemberId(null)}
                className="p-1 text-[#5f6368] hover:text-[#202124] hover:bg-[#f1f3f4] rounded-full text-xs font-bold"
              >
                ✕
              </button>
            </div>

            {/* Status & Metrics Bar */}
            <div className="grid grid-cols-2 gap-1.5 pt-1 border-t border-[#f1f3f4] text-xs">
              <div className="bg-[#f8f9fa] p-1.5 rounded-xl border border-[#dadce0] text-center">
                <span className="text-[9px] text-[#5f6368] block font-medium">Status</span>
                <span className={`font-bold text-[11px] ${isArrived ? 'text-[#137333]' : isStopped ? 'text-[#d93025]' : isSplit ? 'text-[#b06000]' : 'text-[#137333]'}`}>
                  {isArrived ? '✓ Arrived' : isStopped ? '🛑 Stopped' : isSplit ? '⚠ Behind' : '🟢 Moving'}
                </span>
              </div>
              <div className="bg-[#f8f9fa] p-1.5 rounded-xl border border-[#dadce0] text-center">
                <span className="text-[9px] text-[#5f6368] block font-medium">Speed</span>
                <span className="font-mono font-bold text-[11px] text-[#202124]">
                  {isArrived || isStopped ? '0 km/h' : sel.speed !== null ? `${Math.round(sel.speed)} km/h` : '--'}
                </span>
              </div>
            </div>

            {/* Additional Context Banners */}
            {isArrived && (
              <p className="text-[11px] text-[#137333] font-semibold bg-[#e6f4ea] px-2.5 py-1 rounded-xl border border-[#ceead6]">
                Reached destination {sel.arrivedAtTimeText ? `at ${sel.arrivedAtTimeText}` : ''}
              </p>
            )}
            {isStopped && (
              <div className="space-y-1">
                <p className="text-[11px] text-[#c5221f] font-semibold bg-[#fce8e6] px-2.5 py-1 rounded-xl">
                  Stopped for {sel.stopDurationText || '0 min'} {sel.isLongStop ? '⚠ (Stationary 10+ min)' : ''}
                </p>
                {sel.nearbyPetrol && (
                  <p className="text-[10px] text-[#202124] bg-[#f8f9fa] px-2 py-0.5 rounded-lg border border-[#dadce0]">
                    ⛽ Petrol nearby: <span className="font-semibold">{sel.nearbyPetrol.name} ({sel.nearbyPetrol.distanceText})</span>
                  </p>
                )}
                {sel.nearbyHotel && (
                  <p className="text-[10px] text-[#202124] bg-[#f8f9fa] px-2 py-0.5 rounded-lg border border-[#dadce0]">
                    🏨 Hotel nearby: <span className="font-semibold">{sel.nearbyHotel.name} ({sel.nearbyHotel.distanceText})</span>
                  </p>
                )}
              </div>
            )}
            {isSplit && (
              <p className="text-[11px] text-[#b06000] font-semibold bg-[#fef7e0] px-2.5 py-1 rounded-xl">
                {sel.distanceFromGroupKm ? `${sel.distanceFromGroupKm} km behind convoy` : 'Falling behind convoy'}
              </p>
            )}
          </div>
        );
      })()}

      {/* PROGRESSIVE DISCLOSURE: FLOATING SELECTED POI CARD (Bottom-Left) */}
      {selectedPOI && (
        <div className="absolute bottom-22 sm:bottom-6 left-3 sm:left-4 z-40 max-w-[calc(100vw-24px)] sm:max-w-xs w-full bg-white/95 backdrop-blur-md border border-[#dadce0] p-3 rounded-3xl shadow-xl space-y-2 animate-in fade-in slide-in-from-bottom-2 duration-150 pointer-events-auto text-xs">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-2xl bg-[#e8f0fe] border border-[#d2e3fc] flex items-center justify-center text-base shrink-0">
                {selectedPOI.icon || (selectedPOI.type === 'petrol' ? '⛽' : '🏨')}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <h4 className="text-xs font-bold text-[#202124] truncate">{selectedPOI.name}</h4>
                  <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-[#f1f3f4] text-[#5f6368]">
                    {selectedPOI.categoryText || (selectedPOI.type === 'petrol' ? 'Petrol Station' : 'Hotel')}
                  </span>
                </div>
                <p className="text-[11px] text-[#5f6368] truncate font-medium">
                  {selectedPOI.address || 'Along Highway Route'}
                </p>
              </div>
            </div>

            <button
              onClick={() => setSelectedPOI(null)}
              className="p-1 text-[#5f6368] hover:text-[#202124] hover:bg-[#f1f3f4] rounded-full text-xs font-bold"
            >
              ✕
            </button>
          </div>

          {selectedPOI.distanceText && (
            <div className="pt-1 border-t border-[#f1f3f4] flex items-center justify-between text-xs">
              <span className="text-[#5f6368] font-medium text-[11px]">Distance from route:</span>
              <span className="font-bold text-[#1a73e8] font-mono text-[11px]">{selectedPOI.distanceText}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default CanvasMapVisualizer;
