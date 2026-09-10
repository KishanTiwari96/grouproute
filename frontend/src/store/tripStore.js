import { create } from 'zustand';
import api from '../services/api.js';
import { getSocket } from '../services/socket.js';

/**
 * Universal Selector: Merges database group members and real-time live reporting travelers
 * into a deduplicated, rich, intelligently sorted traveler array with Convoy Intelligence.
 * Evaluates: Leader, Arrived, Long Stop, Behind, Speed, Distance, and Progress.
 */
export function selectTravelers(members = [], liveLocations = {}, currentUserId = null, tripDestination = null) {
  const memberMap = new Map();
  const currentUserName = members.find(m => m.id === currentUserId)?.name?.toLowerCase() || '';

  // 1. Ingest database registered group members
  (members || []).forEach((m) => {
    if (m && m.id) {
      memberMap.set(m.id, {
        id: m.id,
        name: m.name || 'Traveler',
        email: m.email || '',
        profile_image: m.profile_image || `https://api.dicebear.com/7.x/avataaars/svg?seed=${m.name || m.id}`,
        role: m.role || 'MEMBER',
        location_sharing: m.location_sharing !== false,
        assigned_route_polyline: m.assigned_route_polyline || null
      });
    }
  });

  // 2. Ingest/Merge live reporting members from Redis/Socket.IO with alias resolution
  Object.values(liveLocations || {}).forEach((loc) => {
    if (!loc || (!loc.userId && !loc.id)) return;
    const rawId = loc.userId || loc.id;
    const rawName = (loc.userName || '').toLowerCase();

    // Check if this simulated record is an alias for the current logged-in user
    let targetId = rawId;
    if (currentUserId && (rawId === currentUserId || (rawId.startsWith('sim-') && currentUserName && (rawName === currentUserName || currentUserName.includes(rawName))))) {
      targetId = currentUserId;
    }

    const existing = memberMap.get(targetId) || {};
    memberMap.set(targetId, {
      ...existing,
      id: targetId,
      name: (targetId === currentUserId && existing.name) ? existing.name : (loc.userName || existing.name || 'Traveler'),
      profile_image: (targetId === currentUserId && existing.profile_image) ? existing.profile_image : (loc.userImage || existing.profile_image || `https://api.dicebear.com/7.x/avataaars/svg?seed=${loc.userName || targetId}`),
      role: existing.role || 'MEMBER',
      location_sharing: loc.locationSharing !== false
    });
  });

  const now = Date.now();

  // 3. Compile full traveler intelligence state
  const rawTravelers = Array.from(memberMap.values()).map((traveler) => {
    // Find location telemetry (check direct ID or aliased simulated ID)
    let loc = (liveLocations && liveLocations[traveler.id]) || null;
    if (!loc && traveler.id === currentUserId) {
      const simAlias = Object.values(liveLocations || {}).find(l => {
        if (!l) return false;
        const lName = (l.userName || '').toLowerCase();
        return l.userId?.startsWith('sim-') && currentUserName && (lName === currentUserName || currentUserName.includes(lName));
      });
      if (simAlias) loc = simAlias;
    }
    loc = loc || {};

    const isMe = traveler.id === currentUserId;
    const isSharingOff = traveler.location_sharing === false || loc.locationSharing === false || loc.status === 'LOCATION_OFF';

    // Freshness & Stale Calculation
    const timestamp = loc.timestamp || (loc.lastSeen ? new Date(loc.lastSeen).getTime() : null);
    const ageSeconds = timestamp ? Math.max(0, Math.round((now - timestamp) / 1000)) : null;
    const isStale = ageSeconds !== null && ageSeconds > 180; // older than 3 mins

    // Status resolution (exclusive, non-conflicting)
    let status = 'OFFLINE';
    if (isSharingOff) {
      status = 'LOCATION_OFF';
    } else if (loc.status === 'ARRIVED') {
      status = 'ARRIVED';
    } else if (isStale) {
      status = 'STALE';
    } else if (loc.status) {
      status = loc.status; // 'MOVING' | 'POSSIBLE_STOP' | 'STOPPED' | 'SPLIT' | 'REJOINED' | 'ARRIVED'
    } else if (loc.latitude && loc.longitude) {
      status = (loc.speed && loc.speed > 3) ? 'MOVING' : 'STOPPED';
    }

    // Stop duration calculation
    let stopDurationText = null;
    let isLongStop = loc.isLongStop || false;
    let stopDurationMinutes = 0;

    if (status === 'STOPPED' || status === 'POSSIBLE_STOP') {
      if (loc.stoppedSince) {
        const stopStartMs = new Date(loc.stoppedSince).getTime();
        const stoppedSec = Math.max(0, Math.round((now - stopStartMs) / 1000));
        stopDurationMinutes = Math.round(stoppedSec / 60);
        stopDurationText = stopDurationMinutes < 1 ? 'Just stopped' : `${stopDurationMinutes} min`;
      } else if (loc.stopDurationSeconds) {
        stopDurationMinutes = Math.round(loc.stopDurationSeconds / 60);
        stopDurationText = stopDurationMinutes < 1 ? 'Just stopped' : `${stopDurationMinutes} min`;
      }

      if (stopDurationMinutes >= 10) {
        isLongStop = true;
      }
    }

    // Arrival formatted time
    let arrivedAtTimeText = null;
    if (status === 'ARRIVED' && loc.arrivedAt) {
      const arrivedDate = new Date(loc.arrivedAt);
      arrivedAtTimeText = arrivedDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    // Best Location Name (City / Highway / Landmark)
    let locationName = loc.stoppedLocationName || loc.locationName || null;
    if (!locationName && loc.latitude && loc.longitude) {
      locationName = `${loc.latitude.toFixed(4)}, ${loc.longitude.toFixed(4)}`;
    }

    // Route progress
    const routeProgress = loc.routeProgress !== undefined ? loc.routeProgress : 0;
    const distanceToDestinationKm = loc.distanceToDestinationKm !== undefined ? loc.distanceToDestinationKm : null;

    return {
      ...traveler,
      isMe,
      status,
      speed: (status === 'STOPPED' || status === 'POSSIBLE_STOP' || status === 'ARRIVED') ? 0 : (loc.speed !== undefined ? loc.speed : null),
      heading: loc.heading || 0,
      latitude: loc.latitude || null,
      longitude: loc.longitude || null,
      accuracy: loc.accuracy || null,
      distanceFromGroupKm: loc.distanceFromGroupKm !== undefined ? loc.distanceFromGroupKm : null,
      eta: status === 'ARRIVED' ? 'Arrived' : (loc.eta || null),
      locationName: status === 'ARRIVED'
        ? (tripDestination || locationName || 'Destination Point')
        : (locationName || (isSharingOff ? 'Location sharing off' : 'Location unavailable')),
      stoppedLocationName: loc.stoppedLocationName || null,
      stoppedSince: loc.stoppedSince || null,
      stopDurationText,
      stopDurationMinutes,
      isLongStop,
      nearbyPetrol: loc.nearbyPetrol || null,
      nearbyHotel: loc.nearbyHotel || null,
      arrivedAt: loc.arrivedAt || null,
      arrivedAtTimeText,
      routeProgress,
      distanceToDestinationKm,
      isLeader: false, // Calculated in pass below
      lastSeen: timestamp,
      ageSeconds,
      isStale,
      isSharingOff,
      assigned_route_polyline: traveler.assigned_route_polyline || null
    };
  });

  // 4. Determine Leader among active non-arrived travelers based on route progress
  const activeTraveling = rawTravelers.filter(t => t.status !== 'ARRIVED' && t.latitude && t.longitude && !t.isSharingOff);
  let leaderId = null;
  let maxProgress = -1;
  let leaderTravelerObj = null;

  if (activeTraveling.length > 0) {
    for (const t of activeTraveling) {
      const prog = t.routeProgress !== undefined ? t.routeProgress : (1000 - (t.distanceToDestinationKm || 1000));
      if (prog > maxProgress) {
        maxProgress = prog;
        leaderId = t.id;
        leaderTravelerObj = t;
      }
    }
  }

  const travelers = rawTravelers.map(t => {
    const isLeader = t.id === leaderId && t.status !== 'ARRIVED';
    let convoyRole = 'MAIN_CONVOY';
    if (t.status === 'ARRIVED') convoyRole = 'ARRIVED';
    else if (isLeader) convoyRole = 'LEADER';
    else if (t.status === 'SPLIT' || t.status === 'FALLING_BEHIND' || t.status === 'OFF_ROUTE') convoyRole = 'BEHIND';
    else if (t.status === 'STOPPED' || t.status === 'POSSIBLE_STOP') convoyRole = 'STOPPED';

    // Calculate relative distance and human-readable position statement
    let distanceFromLeaderKm = null;
    let relativePositionText = 'With group';

    if (isLeader) {
      relativePositionText = 'Leader';
    } else if (t.status === 'ARRIVED') {
      relativePositionText = 'Arrived';
    } else if (t.status === 'OFF_ROUTE') {
      relativePositionText = 'Off route';
    } else if (t.status === 'STOPPED' || t.status === 'POSSIBLE_STOP') {
      relativePositionText = 'Stopped';
    } else if (leaderTravelerObj && leaderTravelerObj.distanceToDestinationKm !== null && t.distanceToDestinationKm !== null) {
      const diff = Math.round((t.distanceToDestinationKm - leaderTravelerObj.distanceToDestinationKm) * 10) / 10;
      if (diff > 0.3) {
        distanceFromLeaderKm = diff;
        relativePositionText = `${diff} km behind leader`;
      } else if (diff < -0.3) {
        distanceFromLeaderKm = diff;
        relativePositionText = `${Math.abs(diff)} km ahead of convoy`;
      } else {
        relativePositionText = 'With group';
      }
    } else if (t.distanceFromGroupKm !== null) {
      if (t.distanceFromGroupKm > 2) {
        relativePositionText = `${t.distanceFromGroupKm} km behind leader`;
      } else {
        relativePositionText = 'With group';
      }
    }

    return {
      ...t,
      isLeader,
      convoyRole,
      distanceFromLeaderKm,
      relativePositionText
    };
  });

  // 5. Intelligent Convoy Hierarchy Sorting:
  // 1. Leader -> 2. Arrived -> 3. Behind -> 4. Stopped -> 5. Moving -> 6. Offline
  return travelers.sort((a, b) => {
    if (a.isLeader && !b.isLeader) return -1;
    if (!a.isLeader && b.isLeader) return 1;

    const roleRank = (role) => {
      if (role === 'LEADER') return 1;
      if (role === 'ARRIVED') return 2;
      if (role === 'BEHIND') return 3;
      if (role === 'STOPPED') return 4;
      if (role === 'MAIN_CONVOY') return 5;
      return 6;
    };

    const rankA = roleRank(a.convoyRole);
    const rankB = roleRank(b.convoyRole);
    if (rankA !== rankB) return rankA - rankB;

    return a.name.localeCompare(b.name);
  });
}

export const useTripStore = create((set, get) => ({
  trip: null,
  group: null,
  isOwner: false,
  members: [],
  liveLocations: {},
  stops: [],
  pois: [],
  events: [],
  chatMessages: [],
  groupCenter: null,
  groupEta: { formattedEta: 'Calculating...', totalMinutes: 0 },
  routeCoords: [], // Fetched polyline geometry for the map and simulation
  
  // UI & Interaction states
  selectedMemberId: null,
  selectedStop: null,
  selectedPOI: null,
  activeAlert: null,
  isSharingLocation: true,
  isLoadingTrip: true,
  connectionStatus: 'connected',
  offlineQueueCount: 0,

  // Map camera focus & coordination state
  mapFocus: null, // { lat, lng, zoom, fitGroup, targetId, timestamp }
  layerVisibility: { route: true, stops: true, members: true, petrol: true, hotels: true },
  isDrawerOpen: true,
  activeDrawerTab: 'MEMBERS', // 'MEMBERS' | 'TIMELINE' | 'CHAT'

  // Simulation mode states
  isSimulationActive: false,
  simulationSpeed: 1, // 1x, 2x, 5x, 10x
  simulationScenario: 'standard',

  // Actions
  fetchTripDetails: async (tripId) => {
    set({ isLoadingTrip: true });
    try {
      const [data, poisRes] = await Promise.all([
        api.getTripDetails(tripId),
        api.getTripPOIs ? api.getTripPOIs(tripId).catch(() => ({ pois: [] })) : Promise.resolve({ pois: [] })
      ]);

      set({
        trip: data.trip,
        group: data.group,
        isOwner: data.isOwner,
        members: data.members || [],
        liveLocations: data.liveLocations || {},
        stops: data.stops || [],
        pois: (poisRes && Array.isArray(poisRes.pois)) ? poisRes.pois : [],
        events: data.events || [],
        chatMessages: data.chatMessages || [],
        isLoadingTrip: false
      });
      return data;
    } catch (err) {
      console.error('[TripStore] Fetch error:', err);
      set({ isLoadingTrip: false });
      throw err;
    }
  },

  setTripData: (data) => set(data),
  setRouteCoords: (coords) => set({ routeCoords: coords }),

  setLiveLocations: (locations) => {
    set((state) => {
      // Upsert into members array without duplicates
      const newMembers = [...state.members];
      Object.values(locations || {}).forEach((loc) => {
        if (loc && (loc.userId || loc.id)) {
          const id = loc.userId || loc.id;
          const exists = newMembers.some((m) => m.id === id);
          if (!exists) {
            newMembers.push({
              id,
              name: loc.userName || 'Traveler',
              email: '',
              profile_image: loc.userImage || '',
              role: 'MEMBER',
              location_sharing: loc.locationSharing !== false,
              joined_at: new Date().toISOString()
            });
          }
        }
      });

      return {
        liveLocations: locations,
        members: newMembers
      };
    });
  },

  updateMemberLocation: (location) => {
    set((state) => {
      const userId = location.userId || location.id;
      if (!userId) return state;

      // Upsert into members array without duplicates
      const newMembers = [...state.members];
      const memberIndex = newMembers.findIndex((m) => m.id === userId);
      if (memberIndex === -1) {
        newMembers.push({
          id: userId,
          name: location.userName || 'Traveler',
          email: '',
          profile_image: location.userImage || '',
          role: 'MEMBER',
          location_sharing: location.locationSharing !== false,
          joined_at: new Date().toISOString()
        });
      } else if (location.userName && !newMembers[memberIndex].name) {
        newMembers[memberIndex] = {
          ...newMembers[memberIndex],
          name: location.userName,
          profile_image: location.userImage || newMembers[memberIndex].profile_image
        };
      }

      return {
        liveLocations: {
          ...state.liveLocations,
          [userId]: location
        },
        members: newMembers
      };
    });
  },

  setGroupCenterAndEta: (groupCenter, groupEta) => {
    set({ groupCenter, groupEta });
  },

  addEvent: (event) => {
    set((state) => {
      if (state.events.some(e => e.id === event.id)) return state;
      const updatedEvents = [event, ...state.events];

      let alert = null;
      if (event.event_type === 'MEMBER_FELL_BEHIND' || event.event_type === 'GROUP_SPLIT') {
        alert = {
          type: 'warning',
          title: 'Convoy Separation Alert',
          message: event.metadata?.message || `${event.user_name} is falling behind the convoy!`,
          targetUserId: event.user_id,
          userName: event.user_name,
          actionLabel: `View ${event.user_name}`,
          timestamp: Date.now()
        };
      } else if (event.event_type === 'LONG_STOP') {
        alert = {
          type: 'danger',
          title: 'Stationary Stop (10+ min)',
          message: event.metadata?.message || `${event.user_name} has stopped for 10 min!`,
          targetUserId: event.user_id,
          userName: event.user_name,
          locationName: event.location_name,
          nearbyPetrol: event.metadata?.nearbyPetrol,
          nearbyHotel: event.metadata?.nearbyHotel,
          actionLabel: 'View Stop',
          timestamp: Date.now()
        };
      } else if (event.event_type === 'STOP_STARTED') {
        alert = {
          type: 'danger',
          title: 'Stop Detected',
          message: `${event.user_name} stopped at ${event.location_name || 'Highway'}`,
          targetStopId: event.metadata?.stopId,
          targetUserId: event.user_id,
          userName: event.user_name,
          locationName: event.location_name,
          actionLabel: 'View Stop',
          timestamp: Date.now()
        };
      } else if (event.event_type === 'MEMBER_ARRIVED') {
        alert = {
          type: 'success',
          title: 'Destination Reached',
          message: event.metadata?.message || `${event.user_name} has arrived at destination!`,
          targetUserId: event.user_id,
          userName: event.user_name,
          actionLabel: `View ${event.user_name}`,
          timestamp: Date.now()
        };
      } else if (event.event_type === 'ALL_MEMBERS_ARRIVED') {
        alert = {
          type: 'success',
          title: 'Everyone Has Arrived!',
          message: event.metadata?.message || `All travelers have reached destination!`,
          actionLabel: 'View Group',
          timestamp: Date.now()
        };
      } else if (event.event_type === 'MEMBER_REJOINED') {
        alert = {
          type: 'success',
          title: 'Member Rejoined',
          message: event.metadata?.message || `${event.user_name} rejoined the convoy!`,
          targetUserId: event.user_id,
          userName: event.user_name,
          actionLabel: `View ${event.user_name}`,
          timestamp: Date.now()
        };
      }

      return {
        events: updatedEvents,
        ...(alert && { activeAlert: alert })
      };
    });
  },

  addStop: (stop) => {
    set((state) => ({
      stops: [stop, ...state.stops.filter(s => s.id !== stop.id)]
    }));
  },

  updateStop: (stop) => {
    set((state) => ({
      stops: state.stops.map(s => s.id === stop.id ? { ...s, ...stop } : s)
    }));
  },

  updateMemberStatus: (userId, status, locationSharing) => {
    set((state) => {
      const loc = state.liveLocations[userId];
      if (!loc) return state;
      return {
        liveLocations: {
          ...state.liveLocations,
          [userId]: {
            ...loc,
            status: status || loc.status,
            ...(locationSharing !== undefined && { locationSharing })
          }
        }
      };
    });
  },

  setSelectedMemberId: (id) => set({ selectedMemberId: id }),

  setSelectedStop: (stop) => set({ selectedStop: stop }),

  setSelectedPOI: (poi) => set({ selectedPOI: poi }),

  setPOIs: (pois) => set({ pois: Array.isArray(pois) ? pois : [] }),

  clearActiveAlert: () => set({ activeAlert: null }),

  // Map camera focus and navigation actions
  focusLocation: (lat, lng, zoom = 14) => {
    set({
      mapFocus: { lat, lng, zoom, timestamp: Date.now() }
    });
  },

  fitConvoy: () => {
    set({
      mapFocus: { fitGroup: true, timestamp: Date.now() }
    });
  },

  focusMember: (userId) => {
    const loc = get().liveLocations[userId];
    if (loc && loc.latitude && loc.longitude) {
      set({
        selectedMemberId: userId,
        mapFocus: {
          lat: loc.latitude,
          lng: loc.longitude,
          zoom: 15,
          targetId: userId,
          timestamp: Date.now()
        }
      });
    } else {
      set({ selectedMemberId: userId });
    }
  },

  focusStop: (stop) => {
    if (stop && stop.latitude && stop.longitude) {
      set({
        selectedStop: stop,
        mapFocus: {
          lat: stop.latitude,
          lng: stop.longitude,
          zoom: 15,
          targetId: stop.id,
          timestamp: Date.now()
        }
      });
    } else {
      set({ selectedStop: stop });
    }
  },

  toggleLayer: (layerName) => {
    set((state) => ({
      layerVisibility: {
        ...state.layerVisibility,
        [layerName]: !state.layerVisibility[layerName]
      }
    }));
  },

  setDrawerOpen: (isOpen) => set({ isDrawerOpen: isOpen }),
  setActiveDrawerTab: (tab) => set({ activeDrawerTab: tab, isDrawerOpen: tab !== null }),
  addChatMessage: (message) => set((state) => ({
    chatMessages: [...state.chatMessages, message].slice(-100)
  })),
  setChatMessages: (messages) => set({ chatMessages: messages.slice(-100) }),

  toggleLocationSharing: () => {
    const nextVal = !get().isSharingLocation;
    set({ isSharingLocation: nextVal });
    const socket = getSocket();
    const trip = get().trip;
    if (socket && trip) {
      if (nextVal) {
        socket.emit('location:sharing:start', { tripId: trip.id });
      } else {
        socket.emit('location:sharing:stop', { tripId: trip.id });
      }
    }
  },

  setSimulationActive: (active) => set({ isSimulationActive: active }),
  setSimulationSpeed: (speed) => set({ simulationSpeed: speed }),
  setSimulationScenario: (scenario) => set({ simulationScenario: scenario }),
  setConnectionStatus: (status) => set({ connectionStatus: status }),
  setOfflineQueueCount: (count) => set({ offlineQueueCount: count }),

  resetTrip: () => set({
    trip: null,
    group: null,
    members: [],
    liveLocations: {},
    stops: [],
    pois: [],
    events: [],
    chatMessages: [],
    groupCenter: null,
    groupEta: { formattedEta: 'Calculating...', totalMinutes: 0 },
    routeCoords: [],
    selectedMemberId: null,
    selectedStop: null,
    selectedPOI: null,
    activeAlert: null,
    mapFocus: null,
    isSimulationActive: false,
    offlineQueueCount: 0
  })
}));

export default useTripStore;
