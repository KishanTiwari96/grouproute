import React from 'react';
import { Users, Eye, EyeOff, AlertTriangle, Navigation, Clock, MapPin, Gauge, CheckCircle2 } from 'lucide-react';
import useTripStore, { selectTravelers } from '../../store/tripStore.js';
import useAuthStore from '../../store/authStore.js';
import StatusBadge from '../common/StatusBadge.jsx';
import { formatDistance, formatSpeed, timeAgo } from '../../utils/formatters.js';

export function MemberList() {
  const {
    members,
    liveLocations,
    trip,
    selectedMemberId,
    focusMember,
    isSharingLocation,
    toggleLocationSharing
  } = useTripStore();

  const { user: currentUser } = useAuthStore();

  const travelers = selectTravelers(members, liveLocations, currentUser?.id, trip?.destination);

  // Group status counts
  const leaderTraveler = travelers.find(t => t.isLeader);
  const arrivedCount = travelers.filter(t => t.status === 'ARRIVED').length;
  const movingCount = travelers.filter(t => t.status === 'MOVING' || t.status === 'REJOINED').length;
  const stoppedCount = travelers.filter(t => t.status === 'STOPPED' || t.status === 'POSSIBLE_STOP').length;
  const splitCount = travelers.filter(t => t.status === 'SPLIT' || t.status === 'FALLING_BEHIND').length;
  const offlineCount = travelers.filter(t => t.status === 'OFFLINE' || t.status === 'STALE' || t.status === 'LOCATION_OFF').length;

  return (
    <div className="flex flex-col h-full overflow-hidden bg-white">
      {/* Subheader Toolbar with Convoy Hierarchy Summary */}
      <div className="p-3 border-b border-[#dadce0] bg-[#f8f9fa] space-y-2 shrink-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="p-1.5 rounded-full bg-[#e8f0fe] text-[#1a73e8] shrink-0">
              <Users className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h3 className="text-xs sm:text-sm font-bold text-[#202124]">
                  Travelers ({travelers.length})
                </h3>
                {leaderTraveler && (
                  <span className="text-[9px] font-extrabold px-1.5 py-0.2 rounded-full bg-[#fef7e0] text-[#b06000] border border-[#feefc3] shrink-0">
                    👑 {leaderTraveler.name} · Leader
                  </span>
                )}
              </div>
              <p className="text-[10px] font-medium text-[#5f6368] truncate mt-0.5">
                {movingCount > 0 && <span className="text-[#137333] font-semibold">🟢 {movingCount} Moving</span>}
                {stoppedCount > 0 && <span> · <span className="text-[#c5221f] font-semibold">🔴 {stoppedCount} Stopped</span></span>}
                {splitCount > 0 && <span> · <span className="text-[#b06000] font-semibold">⚠ {splitCount} Behind</span></span>}
                {arrivedCount > 0 && <span> · <span className="text-[#137333] font-semibold">🏁 {arrivedCount} Arrived</span></span>}
              </p>
            </div>
          </div>

          {/* Location Privacy Toggle */}
          <button
            onClick={toggleLocationSharing}
            title={isSharingLocation ? 'Location sharing is ON (Click to disable)' : 'Location sharing is OFF (Click to enable)'}
            className={`flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-bold transition-all shrink-0 ${
              isSharingLocation
                ? 'bg-[#e6f4ea] text-[#137333] border border-[#ceead6] hover:bg-[#ceead6]'
                : 'bg-[#f1f3f4] text-[#5f6368] border border-[#dadce0]'
            }`}
          >
            {isSharingLocation ? <Eye className="w-3 h-3 text-[#1e8e3e]" /> : <EyeOff className="w-3 h-3 text-[#80868b]" />}
            <span className="hidden xs:inline">{isSharingLocation ? 'Sharing ON' : 'Sharing OFF'}</span>
          </button>
        </div>
      </div>

      {/* Members List */}
      <div className="flex-1 overflow-y-auto p-2 sm:p-3 space-y-2">
        {travelers.map((traveler) => {
          const isSelected = selectedMemberId === traveler.id;
          const isLeader = traveler.isLeader;
          const isArrived = traveler.status === 'ARRIVED';
          const isStopped = traveler.status === 'STOPPED' || traveler.status === 'POSSIBLE_STOP';
          const isSplit = traveler.status === 'SPLIT' || traveler.status === 'FALLING_BEHIND';
          const isOffline = traveler.status === 'OFFLINE' || traveler.status === 'STALE';
          const isSharingOff = traveler.isSharingOff;

          let statusIcon = '🟢';
          let statusText = 'Moving';
          let statusColor = 'text-[#1e8e3e]';

          if (isArrived) {
            statusIcon = '🏁';
            statusText = 'Arrived';
            statusColor = 'text-[#137333]';
          } else if (isStopped) {
            statusIcon = '🔴';
            statusText = 'Stopped';
            statusColor = 'text-[#d93025]';
          } else if (isOffline || isSharingOff) {
            statusIcon = '⚪';
            statusText = 'Offline';
            statusColor = 'text-[#80868b]';
          }

          return (
            <div
              key={traveler.id}
              onClick={() => focusMember(traveler.id)}
              className={`p-3 rounded-2xl border transition-all cursor-pointer ${
                isSelected
                  ? 'bg-[#e8f0fe] border-[#1a73e8] shadow-sm'
                  : 'bg-white hover:bg-[#f8f9fa] border-[#dadce0]'
              }`}
            >
              {/* Row 1: Avatar, Name, Badges, Status + Speed */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  {/* Avatar */}
                  <img
                    src={traveler.profile_image || `https://api.dicebear.com/7.x/avataaars/svg?seed=${traveler.name}`}
                    alt={traveler.name}
                    className="w-10 h-10 rounded-full bg-[#f1f3f4] border border-[#dadce0] shrink-0"
                  />
                  {/* Name & Badges */}
                  <div className="min-w-0 flex flex-col justify-center">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-bold text-[#202124] truncate">
                        {traveler.name}
                      </span>
                      {traveler.isMe && (
                        <span className="text-[9px] uppercase font-bold text-[#5f6368]">
                          YOU
                        </span>
                      )}
                    </div>
                    {isLeader && !isArrived && (
                      <span className="text-[10px] uppercase font-extrabold text-[#b06000]">
                        👑 LEADER
                      </span>
                    )}
                  </div>
                </div>

                {/* Status indicator right side */}
                <div className={`text-right flex flex-col items-end ${statusColor}`}>
                  <div className="flex items-center gap-1 font-bold text-xs">
                    <span>{statusIcon}</span>
                    <span>{statusText}</span>
                  </div>
                  {(traveler.status === 'MOVING' || traveler.status === 'REJOINED' || traveler.status === 'SPLIT' || traveler.status === 'FALLING_BEHIND') && traveler.speed !== null && (
                    <span className="text-[11px] font-bold mt-0.5">{formatSpeed(traveler.speed)}</span>
                  )}
                </div>
              </div>

              {/* Row 2: Location */}
              <div className="mt-2.5 flex items-start gap-1.5 text-xs text-[#5f6368]">
                <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                <span className="truncate">{traveler.locationName || 'Location resolving...'}</span>
              </div>

              {/* Stop Special Banner (Only if stopped) */}
              {isStopped && (
                <div className="mt-2 text-xs text-[#d93025] flex flex-col gap-1">
                  <span className="font-bold flex items-center gap-1">
                    <span>🛑</span> Stopped for {traveler.stopDurationText || 'a few moments'}
                  </span>
                  {traveler.isLongStop && (
                    <span className="text-[#b06000] font-bold flex items-center gap-1">
                      <span>⚠</span> 10-min stop detected
                    </span>
                  )}
                  {traveler.nearbyPetrol && (
                    <span className="text-[#202124] flex items-center gap-1">
                      <span>⛽</span> {traveler.nearbyPetrol.name} nearby
                    </span>
                  )}
                  {traveler.nearbyHotel && (
                    <span className="text-[#202124] flex items-center gap-1">
                      <span>🏨</span> {traveler.nearbyHotel.name} nearby
                    </span>
                  )}
                </div>
              )}

              {/* Row 3: 3 Compact Metrics */}
              {!isSharingOff && !isOffline && traveler.latitude && !isArrived && (
                <div className="mt-3 flex items-center justify-between text-xs border-t border-[#f1f3f4] pt-2">
                  <div className="flex flex-col flex-1 truncate pr-1">
                    <span className="text-[10px] text-[#5f6368] font-medium">Position</span>
                    <span className={`font-bold truncate ${isSplit ? 'text-[#b06000]' : 'text-[#202124]'}`}>
                      {traveler.relativePositionText || (isLeader ? 'Leader' : 'With group')}
                    </span>
                  </div>

                  <div className="flex flex-col flex-1 px-1 border-l border-[#f1f3f4]">
                    <span className="text-[10px] text-[#5f6368] font-medium">Speed</span>
                    <span className="font-mono font-bold text-[#202124]">
                      {isStopped ? '0 km/h' : traveler.speed !== null ? formatSpeed(traveler.speed) : '--'}
                    </span>
                  </div>

                  <div className="flex flex-col flex-1 pl-1 border-l border-[#f1f3f4] text-right">
                    <span className="text-[10px] text-[#5f6368] font-medium">ETA</span>
                    <span className="font-mono font-bold text-[#1a73e8]">
                      {traveler.eta || 'N/A'}
                    </span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default MemberList;
