import React, { useState } from 'react';
import { Clock, AlertTriangle, MapPin, CheckCircle2, Navigation, Flag, UserCheck } from 'lucide-react';
import useTripStore from '../../store/tripStore.js';
import { formatTime } from '../../utils/formatters.js';

export function TripTimeline() {
  const { events, focusMember, focusStop, stops } = useTripStore();
  const [filter, setFilter] = useState('ALL'); // 'ALL' | 'STOPS' | 'ALERTS'

  const getEventVisuals = (event) => {
    switch (event.event_type) {
      case 'TRIP_STARTED':
        return {
          icon: <Navigation className="w-3.5 h-3.5 text-[#1e8e3e]" />,
          badgeBg: 'bg-[#e6f4ea] text-[#137333] border-[#ceead6]',
          title: 'Trip Started',
          description: `${event.user_name} initiated convoy travel.`
        };
      case 'STOP_STARTED':
        let stopDesc = `Stopped at ${event.location_name || event.metadata?.locationName || 'Highway Rest Point'}.`;
        if (event.metadata?.nearbyPetrol?.name) {
          stopDesc += ` (Near ⛽ ${event.metadata.nearbyPetrol.name})`;
        } else if (event.metadata?.nearbyHotel?.name) {
          stopDesc += ` (Near 🏨 ${event.metadata.nearbyHotel.name})`;
        }
        return {
          icon: <span className="text-sm leading-none">🛑</span>,
          badgeBg: 'bg-[#fce8e6] text-[#c5221f] border-[#fad2cf]',
          title: `${event.user_name} stopped`,
          description: stopDesc
        };
      case 'LONG_STOP':
      case 'TEN_MINUTE_STOP':
        return {
          icon: <span className="text-sm leading-none">🛑</span>,
          badgeBg: 'bg-[#fce8e6] text-[#c5221f] border-[#fad2cf]',
          title: '10-Minute Stop Alert',
          description: `${event.user_name} has been stopped for 10+ minutes at ${event.location_name || 'Highway Corridor'}.`
        };
      case 'STOP_ENDED':
        const durationText = event.metadata?.durationMinutes ? `${event.metadata.durationMinutes} min` : 'a short break';
        return {
          icon: <Navigation className="w-3.5 h-3.5 text-[#1a73e8]" />,
          badgeBg: 'bg-[#e8f0fe] text-[#1a73e8] border-[#d2e3fc]',
          title: `${event.user_name} resumed driving`,
          description: `Resumed travel after ${durationText} at ${event.location_name || 'Rest Area'}`
        };
      case 'SEPARATION_ALERT':
      case 'MEMBER_FELL_BEHIND':
      case 'GROUP_SPLIT':
        const dist = event.metadata?.distanceKm || '5+';
        return {
          icon: <AlertTriangle className="w-3.5 h-3.5 text-[#f9ab00]" />,
          badgeBg: 'bg-[#fef7e0] text-[#b06000] border-[#feefc3]',
          title: 'Separation Alert',
          description: `${event.user_name} is ${dist} km behind the convoy.`
        };
      case 'MEMBER_REJOINED':
        return {
          icon: <CheckCircle2 className="w-3.5 h-3.5 text-[#1e8e3e]" />,
          badgeBg: 'bg-[#e6f4ea] text-[#137333] border-[#ceead6]',
          title: 'Member Rejoined',
          description: `${event.user_name} rejoined the group convoy.`
        };
      case 'MEMBER_ARRIVED':
      case 'ARRIVED':
        return {
          icon: <Flag className="w-3.5 h-3.5 text-[#1e8e3e]" />,
          badgeBg: 'bg-[#e6f4ea] text-[#137333] border-[#ceead6]',
          title: `${event.user_name} arrived`,
          description: `Reached destination safely at ${event.location_name || 'Destination Point'}.`
        };
      case 'ALL_MEMBERS_ARRIVED':
      case 'ALL_ARRIVED':
      case 'TRIP_COMPLETED':
        return {
          icon: <Flag className="w-3.5 h-3.5 text-[#7627bb]" />,
          badgeBg: 'bg-[#f3e8fd] text-[#7627bb] border-[#e9d5ff]',
          title: 'Everyone Has Arrived',
          description: event.metadata?.message || 'All group travelers have reached the destination safely!'
        };
      default:
        return {
          icon: <UserCheck className="w-3.5 h-3.5 text-[#5f6368]" />,
          badgeBg: 'bg-[#f1f3f4] text-[#5f6368] border-[#dadce0]',
          title: event.event_type.replace(/_/g, ' '),
          description: event.metadata?.message || 'Activity recorded'
        };
    }
  };

  const filteredEvents = events.filter((e) => {
    if (filter === 'STOPS') return e.event_type === 'STOP_STARTED' || e.event_type === 'STOP_ENDED';
    if (filter === 'ALERTS') return e.event_type === 'MEMBER_FELL_BEHIND' || e.event_type === 'GROUP_SPLIT';
    return true;
  });

  const handleEventClick = (event) => {
    if (event.event_type === 'STOP_STARTED' || event.event_type === 'STOP_ENDED') {
      const matchedStop = stops.find((s) => s.user_id === event.user_id || s.id === event.metadata?.stopId);
      if (matchedStop) {
        focusStop(matchedStop);
        return;
      }
    }
    if (event.user_id) {
      focusMember(event.user_id);
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden bg-white">
      {/* Filter Header */}
      <div className="p-3 sm:p-4 border-b border-[#dadce0] flex items-center justify-between bg-[#f8f9fa]">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-full bg-[#e8f0fe] text-[#1a73e8]">
            <Clock className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs sm:text-sm font-bold text-[#202124]">Activity Feed</h3>
            <p className="text-[10px] text-[#5f6368]">Live convoy trip history</p>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1 bg-[#f1f3f4] p-1 rounded-full text-xs border border-[#dadce0]">
          <button
            onClick={() => setFilter('ALL')}
            className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold transition-all ${
              filter === 'ALL'
                ? 'bg-white text-[#1a73e8] shadow-xs'
                : 'text-[#5f6368] hover:text-[#202124]'
            }`}
          >
            All ({events.length})
          </button>
          <button
            onClick={() => setFilter('STOPS')}
            className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold transition-all ${
              filter === 'STOPS'
                ? 'bg-white text-[#1a73e8] shadow-xs'
                : 'text-[#5f6368] hover:text-[#202124]'
            }`}
          >
            Stops
          </button>
          <button
            onClick={() => setFilter('ALERTS')}
            className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold transition-all ${
              filter === 'ALERTS'
                ? 'bg-white text-[#1a73e8] shadow-xs'
                : 'text-[#5f6368] hover:text-[#202124]'
            }`}
          >
            Alerts
          </button>
        </div>
      </div>

      {/* Timeline List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {filteredEvents.length === 0 ? (
          <div className="h-44 flex flex-col items-center justify-center text-center p-4 text-[#80868b]">
            <Clock className="w-8 h-8 mb-2 opacity-40" />
            <p className="text-xs font-semibold text-[#5f6368]">No activity recorded yet</p>
            <p className="text-[11px] text-[#80868b] mt-1 max-w-xs">
              Trip milestones, stops, and convoy separation alerts will appear here in real time.
            </p>
          </div>
        ) : (
          <div className="relative pl-6 space-y-3.5 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-[#dadce0]">
            {filteredEvents.map((event, idx) => {
              const visuals = getEventVisuals(event);
              return (
                <div
                  key={event.id || idx}
                  onClick={() => handleEventClick(event)}
                  className="relative group cursor-pointer transition-transform hover:-translate-y-0.5"
                >
                  {/* Timeline Dot */}
                  <div className="absolute -left-6 top-1.5 w-4 h-4 rounded-full bg-white border-2 border-[#dadce0] group-hover:border-[#1a73e8] flex items-center justify-center transition-colors">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#80868b] group-hover:bg-[#1a73e8]" />
                  </div>

                  {/* Card Content */}
                  <div className="bg-white hover:bg-[#f8f9fa] border border-[#dadce0] hover:border-[#1a73e8] p-3 rounded-2xl transition-all shadow-xs">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="flex items-center gap-1.5">
                        <span className={`p-1 rounded-lg border text-xs flex items-center justify-center ${visuals.badgeBg}`}>
                          {visuals.icon}
                        </span>
                        <span className="text-xs font-bold text-[#202124] group-hover:text-[#1a73e8] transition-colors">
                          {visuals.title}
                        </span>
                      </div>
                      <span className="text-[10px] font-mono text-[#80868b] whitespace-nowrap">
                        {formatTime(event.created_at)}
                      </span>
                    </div>

                    <p className="text-xs text-[#5f6368] pl-6 leading-relaxed">
                      {visuals.description}
                    </p>

                    {event.location_name && (
                      <div className="mt-1.5 pl-6 flex items-center gap-1 text-[10px] text-[#5f6368] font-medium">
                        <MapPin className="w-3 h-3 text-[#1a73e8] shrink-0" />
                        <span className="truncate">{event.location_name}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default TripTimeline;
