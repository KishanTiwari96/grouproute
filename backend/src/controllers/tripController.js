import { z } from 'zod';
import db from '../models/db.js';
import redisStore from '../services/redisStore.js';
import mapService from '../services/mapService.js';
import eventEngine from '../services/eventEngine.js';
import { broadcastTripTelemetry } from '../sockets/socketHandler.js';
import { v4 as uuidv4 } from 'uuid';

export const createTripSchema = z.object({
  body: z.object({
    group_id: z.string().min(1, 'Group ID is required'),
    name: z.string().min(2, 'Trip name must be at least 2 characters'),
    origin: z.string().min(1, 'Origin is required'),
    destination: z.string().min(1, 'Destination is required'),
    origin_lat: z.number(),
    origin_lng: z.number(),
    destination_lat: z.number(),
    destination_lng: z.number(),
    route_polyline: z.string().optional(),
    distance: z.string().optional(),
    estimated_duration: z.string().optional()
  })
});

const singleLocationPingSchema = z.object({
  latitude: z.number().min(-90).max(90).optional(),
  lat: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  lng: z.number().min(-180).max(180).optional(),
  accuracy: z.number().optional(),
  speed: z.number().optional(),
  heading: z.number().optional(),
  timestamp: z.union([z.number(), z.string()]).refine(val => {
    const ts = typeof val === 'number' ? val : new Date(val).getTime();
    return !isNaN(ts) && ts > 0;
  }, { message: 'Valid positive timestamp required' })
}).refine(
  data => (data.latitude !== undefined && data.latitude !== null) || (data.lat !== undefined && data.lat !== null),
  { message: 'Valid latitude is required (-90 to 90)' }
).refine(
  data => (data.longitude !== undefined && data.longitude !== null) || (data.lng !== undefined && data.lng !== null),
  { message: 'Valid longitude is required (-180 to 180)' }
);

export const syncLocationsSchema = z.object({
  params: z.object({
    tripId: z.string().min(1, 'Trip ID is required')
  }),
  body: z.union([
    z.array(singleLocationPingSchema).min(1, 'Batch must contain at least 1 location').max(200, 'Maximum batch size is 200 locations'),
    z.object({
      locations: z.array(singleLocationPingSchema).min(1, 'Batch must contain at least 1 location').max(200, 'Maximum batch size is 200 locations')
    })
  ])
});

/**
 * Safely extracts the numeric distance in km from a distance string (e.g. "535 km", "120.5 km").
 * Never throws; returns 0 for anything unparseable or missing.
 */
export function parseDistanceKm(distanceStr) {
  if (typeof distanceStr === 'number') {
    return isNaN(distanceStr) ? 0 : Math.max(0, distanceStr);
  }
  if (!distanceStr || typeof distanceStr !== 'string') {
    return 0;
  }
  const match = distanceStr.match(/(\d+(?:\.\d+)?)/);
  if (!match) return 0;
  const val = parseFloat(match[1]);
  return isNaN(val) ? 0 : Math.max(0, val);
}

export const tripController = {
  async createTrip(req, res) {
    try {
      const {
        group_id,
        name,
        origin,
        destination,
        origin_lat,
        origin_lng,
        destination_lat,
        destination_lng,
        route_polyline = '',
        distance = '',
        estimated_duration = ''
      } = req.body;

      // Verify membership & owner role
      const membership = db.tables.get('group_members').find(
        m => m.group_id === group_id && m.user_id === req.user.id
      );

      if (!membership) {
        return res.status(403).json({ error: 'You must be a group member to create a trip.' });
      }

      // If route details missing, calculate via mapService
      let routeData = { polyline: route_polyline, distance, duration: estimated_duration };
      if (!route_polyline && (!distance || !estimated_duration)) {
        const calculated = await mapService.calculateRoute(
          { lat: origin_lat, lng: origin_lng },
          { lat: destination_lat, lng: destination_lng }
        );
        if (!calculated) {
          return res.status(503).json({ error: 'Route data unavailable. Configure a maps provider or provide a verified route.' });
        }
        routeData.polyline = calculated.polyline || '';
        routeData.distance = distance || calculated.distance || '';
        routeData.duration = estimated_duration || calculated.duration || '';
      }

      const trip = db.tables.insert('trips', {
        group_id,
        name: name.trim(),
        origin,
        destination,
        origin_lat,
        origin_lng,
        destination_lat,
        destination_lng,
        route_polyline: routeData.polyline,
        distance: routeData.distance,
        estimated_duration: routeData.duration,
        status: 'PLANNED',
        started_at: null,
        ended_at: null
      });

      // Add creator to trip_members with location sharing default
      db.tables.insert('trip_members', {
        trip_id: trip.id,
        user_id: req.user.id,
        location_sharing: true,
        sharing_started_at: new Date().toISOString(),
        sharing_ended_at: null
      });

      return res.status(201).json({
        message: 'Trip created successfully',
        trip
      });
    } catch (err) {
      console.error('[Trip] Create error:', err);
      return res.status(500).json({ error: 'Failed to create trip.' });
    }
  },

  async getTripDetails(req, res) {
    try {
      const { tripId } = req.params;
      const trip = db.tables.get('trips').find(t => t.id === tripId);

      if (!trip) {
        return res.status(404).json({ error: 'Trip not found.' });
      }

      // Verify membership
      const membership = db.tables.get('group_members').find(
        m => m.group_id === trip.group_id && m.user_id === req.user.id
      );

      if (!membership) {
        return res.status(403).json({ error: 'You do not have access to this trip.' });
      }

      // Ensure visiting group member is registered in trip_members
      const existingTm = db.tables.get('trip_members').find(
        tm => tm.trip_id === tripId && tm.user_id === req.user.id
      );
      if (!existingTm) {
        db.tables.insert('trip_members', {
          trip_id: tripId,
          user_id: req.user.id,
          location_sharing: true,
          sharing_started_at: new Date().toISOString(),
          sharing_ended_at: null
        });
      }

      const group = db.tables.get('groups').find(g => g.id === trip.group_id);
      const groupMembers = db.tables.get('group_members').filter(m => m.group_id === trip.group_id);
      const allUsers = db.tables.get('users');
      const tripMembers = db.tables.get('trip_members').filter(tm => tm.trip_id === tripId);

      // Build member list
      const members = groupMembers.map(gm => {
        const user = allUsers.find(u => u.id === gm.user_id);
        const tm = tripMembers.find(t => t.user_id === gm.user_id);
        return {
          id: gm.user_id,
          name: user ? user.name : 'Unknown',
          email: user ? user.email : '',
          profile_image: user ? user.profile_image : '',
          role: gm.role,
          location_sharing: tm ? tm.location_sharing : false,
          assigned_route_polyline: tm ? tm.assigned_route_polyline : null,
          joined_at: gm.joined_at
        };
      });

      // Get real-time locations from Redis
      const liveLocations = await redisStore.hgetall(`trip:${tripId}:locations`);
      
      // Get stops
      const stops = db.tables.get('stops').filter(s => s.trip_id === tripId);

      // Get timeline events
      const events = db.tables.get('trip_events')
        .filter(e => e.trip_id === tripId)
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

      const chatMessages = db.tables.get('chat_messages')
        .filter(message => message.trip_id === tripId)
        .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

      return res.json({
        trip,
        group,
        isOwner: membership.role === 'OWNER',
        members,
        liveLocations,
        stops,
        events,
        chatMessages
      });
    } catch (err) {
      console.error('[Trip] Get details error:', err);
      return res.status(500).json({ error: 'Failed to fetch trip details.' });
    }
  },

  async startTrip(req, res) {
    try {
      const { tripId } = req.params;
      const trip = db.tables.get('trips').find(t => t.id === tripId);

      if (!trip) {
        return res.status(404).json({ error: 'Trip not found.' });
      }

      // Check owner permission
      const membership = db.tables.get('group_members').find(
        m => m.group_id === trip.group_id && m.user_id === req.user.id
      );

      if (!membership || membership.role !== 'OWNER') {
        return res.status(403).json({ error: 'Only the group owner can start the trip.' });
      }

      const startedAt = new Date().toISOString();
      const updatedTrip = db.tables.update('trips', t => t.id === tripId, {
        status: 'ACTIVE',
        started_at: startedAt
      });

      // Create TRIP_STARTED event
      const startEvent = {
        id: uuidv4(),
        trip_id: tripId,
        user_id: req.user.id,
        user_name: req.user.name,
        user_image: req.user.profile_image,
        event_type: 'TRIP_STARTED',
        latitude: trip.origin_lat,
        longitude: trip.origin_lng,
        metadata: {
          tripName: trip.name,
          origin: trip.origin,
          destination: trip.destination,
          startedAt
        },
        created_at: startedAt
      };
      db.tables.insert('trip_events', startEvent);

      return res.json({
        message: 'Trip started successfully',
        trip: updatedTrip,
        event: startEvent
      });
    } catch (err) {
      console.error('[Trip] Start trip error:', err);
      return res.status(500).json({ error: 'Failed to start trip.' });
    }
  },

  async endTrip(req, res) {
    try {
      const { tripId } = req.params;
      const trip = db.tables.get('trips').find(t => t.id === tripId);

      if (!trip) {
        return res.status(404).json({ error: 'Trip not found.' });
      }

      const membership = db.tables.get('group_members').find(
        m => m.group_id === trip.group_id && m.user_id === req.user.id
      );

      if (!membership || membership.role !== 'OWNER') {
        return res.status(403).json({ error: 'Only the group owner can complete the trip.' });
      }

      const endedAt = new Date().toISOString();
      const updatedTrip = db.tables.update('trips', t => t.id === tripId, {
        status: 'COMPLETED',
        ended_at: endedAt
      });

      // Turn off location sharing for all trip members
      const allTripMembers = db.tables.get('trip_members').filter(tm => tm.trip_id === tripId);
      for (const tm of allTripMembers) {
        db.tables.update('trip_members', m => m.id === tm.id, {
          location_sharing: false,
          sharing_ended_at: endedAt
        });
      }

      // Create TRIP_COMPLETED event
      const endEvent = {
        id: uuidv4(),
        trip_id: tripId,
        user_id: req.user.id,
        user_name: req.user.name,
        user_image: req.user.profile_image,
        event_type: 'TRIP_COMPLETED',
        latitude: trip.destination_lat,
        longitude: trip.destination_lng,
        metadata: {
          tripName: trip.name,
          endedAt
        },
        created_at: endedAt
      };
      db.tables.insert('trip_events', endEvent);
      db.tables.delete('chat_messages', message => message.trip_id === tripId);

      return res.json({
        message: 'Trip completed successfully',
        trip: updatedTrip,
        event: endEvent
      });
    } catch (err) {
      console.error('[Trip] End trip error:', err);
      return res.status(500).json({ error: 'Failed to complete trip.' });
    }
  },

  async updateMemberRoute(req, res) {
    try {
      const { tripId, userId } = req.params;
      const { route_polyline } = req.body;

      const trip = db.tables.get('trips').find(t => t.id === tripId);
      if (!trip) {
        return res.status(404).json({ error: 'Trip not found.' });
      }

      // Check permissions: Only the user or the trip owner can update it
      const membership = db.tables.get('group_members').find(
        m => m.group_id === trip.group_id && m.user_id === req.user.id
      );
      if (!membership || (membership.role !== 'OWNER' && req.user.id !== userId)) {
        return res.status(403).json({ error: 'Permission denied.' });
      }

      const tripMember = db.tables.get('trip_members').find(tm => tm.trip_id === tripId && tm.user_id === userId);
      if (!tripMember) {
        return res.status(404).json({ error: 'User is not a part of this trip.' });
      }

      const updated = db.tables.update('trip_members', tm => tm.id === tripMember.id, {
        assigned_route_polyline: route_polyline
      });

      return res.json({ message: 'Member route updated successfully', member: updated });
    } catch (err) {
      console.error('[Trip] Update member route error:', err);
      return res.status(500).json({ error: 'Failed to update member route.' });
    }
  },

  async getTripTimeline(req, res) {
    try {
      const { tripId } = req.params;
      const events = db.tables.get('trip_events')
        .filter(e => e.trip_id === tripId)
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

      return res.json({ events });
    } catch (err) {
      return res.status(500).json({ error: 'Failed to fetch timeline.' });
    }
  },

  async getTripStops(req, res) {
    try {
      const { tripId } = req.params;
      const stops = db.tables.get('stops')
        .filter(s => s.trip_id === tripId)
        .sort((a, b) => new Date(b.started_at) - new Date(a.started_at));

      return res.json({ stops });
    } catch (err) {
      return res.status(500).json({ error: 'Failed to fetch stops.' });
    }
  },

  async getTripLocations(req, res) {
    try {
      const { tripId } = req.params;
      const liveLocations = await redisStore.hgetall(`trip:${tripId}:locations`);
      return res.json({ locations: liveLocations });
    } catch (err) {
      return res.status(500).json({ error: 'Failed to fetch locations.' });
    }
  },

  async getTripLocationHistory(req, res) {
    try {
      const { tripId } = req.params;
      const history = db.tables.get('locations')
        .filter(l => l.trip_id === tripId)
        .slice(-200); // Last 200 telemetry points

      return res.json({ history });
    } catch (err) {
      return res.status(500).json({ error: 'Failed to fetch location history.' });
    }
  },

  async getUserActiveTrips(req, res) {
    try {
      const userGroupMemberships = db.tables.get('group_members').filter(m => m.user_id === req.user.id);
      const groupIds = userGroupMemberships.map(m => m.group_id);

      const allTrips = db.tables.get('trips').filter(t => groupIds.includes(t.group_id));
      const allGroups = db.tables.get('groups');

      const enriched = allTrips.map(trip => {
        const group = allGroups.find(g => g.id === trip.group_id);
        return {
          ...trip,
          group_name: group ? group.name : 'Group'
        };
      });

      return res.json({
        activeTrips: enriched.filter(t => t.status === 'ACTIVE'),
        recentTrips: enriched.filter(t => t.status !== 'ACTIVE').slice(-10)
      });
    } catch (err) {
      return res.status(500).json({ error: 'Failed to fetch user trips.' });
    }
  },

  async getRecommendedTrips(req, res) {
    try {
      const cutoff = Date.now() - (30 * 24 * 60 * 60 * 1000);
      const routeMap = new Map();

      db.tables.get('trips')
        .filter(trip => {
          const createdAt = new Date(trip.created_at || trip.started_at || 0).getTime();
          return Number.isFinite(createdAt) && createdAt >= cutoff;
        })
        .sort((a, b) => new Date(b.created_at || b.started_at) - new Date(a.created_at || a.started_at))
        .forEach(trip => {
          const routeKey = `${trip.origin}|${trip.destination}`.toLowerCase();
          if (!routeMap.has(routeKey)) {
            routeMap.set(routeKey, {
              id: trip.id,
              name: trip.name,
              origin: trip.origin,
              destination: trip.destination,
              origin_lat: trip.origin_lat,
              origin_lng: trip.origin_lng,
              destination_lat: trip.destination_lat,
              destination_lng: trip.destination_lng,
              distance: trip.distance,
              estimated_duration: trip.estimated_duration,
              created_at: trip.created_at
            });
          }
        });

      return res.json({ recommendations: Array.from(routeMap.values()).slice(0, 6) });
    } catch (err) {
      console.error('[Trip] Recommendations error:', err);
      return res.status(500).json({ error: 'Failed to fetch trip recommendations.' });
    }
  },

  async getTripPOIs(req, res) {
    try {
      const { tripId } = req.params;
      const trip = db.tables.get('trips').find(t => t.id === tripId);
      if (!trip) {
        return res.status(404).json({ error: 'Trip not found.' });
      }

      // Verify membership
      const membership = db.tables.get('group_members').find(
        m => m.group_id === trip.group_id && m.user_id === req.user.id
      );

      if (!membership) {
        return res.status(403).json({ error: 'You do not have access to this trip.' });
      }

      const pois = await mapService.searchRouteCorridorPOIs(
        trip.origin_lat,
        trip.origin_lng,
        trip.destination_lat,
        trip.destination_lng
      );
      return res.json({ pois });
    } catch (err) {
      console.error('[Trip] Get POIs error:', err);
      return res.status(500).json({ error: 'Failed to fetch trip POIs.' });
    }
  },

  async syncLocations(req, res) {
    try {
      const { tripId } = req.params;
      const trip = db.tables.get('trips').find(t => t.id === tripId);
      if (!trip) {
        return res.status(404).json({ error: 'Trip not found.' });
      }

      // Verify membership
      const membership = db.tables.get('group_members').find(
        m => m.group_id === trip.group_id && m.user_id === req.user.id
      );

      if (!membership) {
        return res.status(403).json({ error: 'You do not have access to this trip.' });
      }

      const tripMember = db.tables.get('trip_members').find(
        member => member.trip_id === tripId && member.user_id === req.user.id
      );
      if (!tripMember || tripMember.location_sharing === false) {
        return res.status(403).json({ error: 'Location sharing is disabled for this trip.' });
      }

      if (trip.status !== 'ACTIVE') {
        return res.status(409).json({ error: 'Location updates are only accepted for active trips.' });
      }

      const rawLocations = Array.isArray(req.body) ? req.body : req.body?.locations;
      if (!rawLocations || !Array.isArray(rawLocations) || rawLocations.length === 0) {
        return res.status(400).json({ error: 'Batch must contain at least 1 location.' });
      }

      if (rawLocations.length > 200) {
        return res.status(400).json({ error: 'Batch size exceeds maximum limit of 200 locations.' });
      }

      // Normalize and validate each location ping
      const normalizedPings = [];
      for (let i = 0; i < rawLocations.length; i++) {
        const ping = rawLocations[i];
        if (!ping || typeof ping !== 'object') {
          return res.status(400).json({ error: `Location ping at index ${i} is invalid.` });
        }

        const lat = ping.latitude !== undefined ? Number(ping.latitude) : Number(ping.lat);
        const lng = ping.longitude !== undefined ? Number(ping.longitude) : Number(ping.lng);
        const rawTs = ping.timestamp;

        if (isNaN(lat) || lat < -90 || lat > 90) {
          return res.status(400).json({ error: `Invalid latitude at index ${i}: must be between -90 and 90.` });
        }
        if (isNaN(lng) || lng < -180 || lng > 180) {
          return res.status(400).json({ error: `Invalid longitude at index ${i}: must be between -180 and 180.` });
        }

        const ts = typeof rawTs === 'number' ? rawTs : new Date(rawTs).getTime();
        if (isNaN(ts) || ts <= 0) {
          return res.status(400).json({ error: `Invalid timestamp at index ${i}.` });
        }

        normalizedPings.push({
          latitude: lat,
          longitude: lng,
          accuracy: ping.accuracy !== undefined ? Number(ping.accuracy) : 10,
          speed: ping.speed !== undefined ? Math.max(0, Number(ping.speed)) : 0,
          heading: ping.heading !== undefined ? Number(ping.heading) : 0,
          timestamp: ts
        });
      }

      // Sort the batch chronologically (ascending by timestamp)
      normalizedPings.sort((a, b) => a.timestamp - b.timestamp);

      // Replay each ping sequentially through the exact same eventEngine pipeline
      let finalResult = null;
      const allGeneratedEvents = [];

      for (const ping of normalizedPings) {
        const result = await eventEngine.processLocationUpdate({
          tripId,
          userId: req.user.id,
          latitude: ping.latitude,
          longitude: ping.longitude,
          accuracy: ping.accuracy,
          speed: ping.speed,
          heading: ping.heading,
          timestamp: ping.timestamp
        });
        finalResult = result;
        if (result.events && result.events.length > 0) {
          allGeneratedEvents.push(...result.events);
        }
      }

      // Broadcast resulting state to the trip room via socket
      const io = req.app.get('io');
      if (io && finalResult) {
        broadcastTripTelemetry(io, tripId, finalResult, allGeneratedEvents);
      }

      return res.json({
        success: true,
        syncedCount: normalizedPings.length,
        latestLocation: finalResult?.updatedLocation,
        groupCenter: finalResult?.groupCenter,
        groupEta: finalResult?.groupEta,
        events: allGeneratedEvents
      });
    } catch (err) {
      console.error('[TripController] syncLocations error:', err);
      return res.status(500).json({ error: err.message || 'Failed to sync offline locations.' });
    }
  },

  async getTripHistory(req, res) {
    try {
      const allTripMembers = db.tables.get('trip_members');
      const allTrips = db.tables.get('trips');
      const allGroups = db.tables.get('groups');

      // Scope to completed trips the user actually took part in (via trip_members)
      const userTripMemberEntries = allTripMembers.filter(tm => tm.user_id === req.user.id);
      const joinedTripIds = new Set(userTripMemberEntries.map(tm => tm.trip_id));

      const completedTrips = allTrips
        .filter(t => joinedTripIds.has(t.id) && t.status === 'COMPLETED')
        .map(t => {
          const group = allGroups.find(g => g.id === t.group_id);
          return {
            ...t,
            group_name: group?.name || 'Group',
            distanceKm: parseDistanceKm(t.distance)
          };
        })
        .sort((a, b) => {
          const timeA = new Date(a.ended_at || a.created_at || 0).getTime();
          const timeB = new Date(b.ended_at || b.created_at || 0).getTime();
          return timeB - timeA;
        });

      return res.json({ trips: completedTrips });
    } catch (err) {
      console.error('[Trip] Get history error:', err);
      return res.status(500).json({ error: 'Failed to fetch trip history.' });
    }
  },

  async getTripStats(req, res) {
    try {
      const allTripMembers = db.tables.get('trip_members');
      const allTrips = db.tables.get('trips');
      const allUsers = db.tables.get('users');

      // Scope to completed trips the user actually took part in (via trip_members)
      const userTripMemberEntries = allTripMembers.filter(tm => tm.user_id === req.user.id);
      const joinedTripIds = new Set(userTripMemberEntries.map(tm => tm.trip_id));

      const completedTrips = allTrips.filter(t => joinedTripIds.has(t.id) && t.status === 'COMPLETED');

      // Handle zero-trips case cleanly
      if (completedTrips.length === 0) {
        return res.json({
          tripsCompleted: 0,
          totalDistanceKm: 0,
          longestTrip: null,
          topCompanion: null
        });
      }

      const tripsCompleted = completedTrips.length;
      let totalDistance = 0;
      let longestTrip = null;
      let maxDist = -1;

      for (const trip of completedTrips) {
        const dist = parseDistanceKm(trip.distance);
        totalDistance += dist;
        if (dist > maxDist) {
          maxDist = dist;
          longestTrip = {
            id: trip.id,
            name: trip.name,
            distanceKm: Math.round(dist * 10) / 10,
            origin: trip.origin,
            destination: trip.destination
          };
        }
      }

      // Compute top companion across all completed trips this user participated in
      const completedTripIdSet = new Set(completedTrips.map(t => t.id));
      const companionCounts = new Map();

      for (const tm of allTripMembers) {
        if (completedTripIdSet.has(tm.trip_id) && tm.user_id !== req.user.id) {
          companionCounts.set(tm.user_id, (companionCounts.get(tm.user_id) || 0) + 1);
        }
      }

      let topCompanion = null;
      if (companionCounts.size > 0) {
        let maxTripsTogether = 0;
        let bestCompanionId = null;

        for (const [companionId, count] of companionCounts.entries()) {
          if (count > maxTripsTogether) {
            maxTripsTogether = count;
            bestCompanionId = companionId;
          }
        }

        if (bestCompanionId) {
          const companionUser = allUsers.find(u => u.id === bestCompanionId);
          topCompanion = {
            userId: bestCompanionId,
            name: companionUser ? companionUser.name : 'Companion',
            profile_image: companionUser?.profile_image || `https://api.dicebear.com/7.x/avataaars/svg?seed=${companionUser?.name || bestCompanionId}`,
            tripsTogether: maxTripsTogether
          };
        }
      }

      return res.json({
        tripsCompleted,
        totalDistanceKm: Math.round(totalDistance * 10) / 10,
        longestTrip,
        topCompanion
      });
    } catch (err) {
      console.error('[Trip] Get stats error:', err);
      return res.status(500).json({ error: 'Failed to fetch trip statistics.' });
    }
  }
};

export default tripController;

