import { haversineDistanceKm, haversineDistanceMeters, calculateCentroid, distanceToPolylineMeters } from '../utils/geo.js';
import mapService from './mapService.js';
import redisStore from './redisStore.js';
import db from '../models/db.js';
import { v4 as uuidv4 } from 'uuid';

// In-memory state tracking buffers for state-machine transitions
const memberStateBuffers = new Map(); // key: `${tripId}:${userId}`

function getMemberBuffer(tripId, userId) {
  const key = `${tripId}:${userId}`;
  if (!memberStateBuffers.has(key)) {
    memberStateBuffers.set(key, {
      lastLocations: [],
      currentStatus: 'MOVING',
      stopCandidateStartTime: null,
      activeStopId: null,
      activeStopStartTime: null,
      activeStopLocationName: null,
      activeStopCoords: null,
      isLongStopAlerted: false,
      isArrivedEmitted: false,
      arrivedAt: null,
      splitCandidateStartTime: null,
      rejoinCandidateStartTime: null,
      isSplitAlerted: false,
      lastEmittedRejoinTime: 0,
      isOffRoute: false
    });
  }
  return memberStateBuffers.get(key);
}

export const eventEngine = {
  /**
   * Main pipeline: Ingest a raw location telemetry update, process through
   * detection engines, update Redis, persist if needed, and return generated events.
   */
  async processLocationUpdate({ tripId, userId, latitude, longitude, accuracy = 10, speed = 0, heading = 0, timestamp = Date.now() }) {
    // 1. Fetch trip details
    const trip = db.tables.get('trips').find(t => t.id === tripId);
    if (!trip) {
      throw new Error(`Trip ${tripId} not found`);
    }

    const user = db.tables.get('users').find(u => u.id === userId);
    const userName = user ? user.name : 'Group Member';
    const userImage = user ? user.profile_image : '';

    const buffer = getMemberBuffer(tripId, userId);
    const generatedEvents = [];

    const stopTimeThreshold = parseInt(process.env.STOP_DETECTION_TIME_MS || '20000', 10);
    const longStopTimeThreshold = parseInt(process.env.LONG_STOP_THRESHOLD_MS || '600000', 10); // 10 minutes default
    const splitDistanceThreshold = parseFloat(process.env.SPLIT_DISTANCE_KM || '5.0');
    const rejoinDistanceThreshold = parseFloat(process.env.REJOIN_DISTANCE_KM || '2.0');
    const splitDetectionTimeMs = parseInt(process.env.SPLIT_DETECTION_TIME_MS || '20000', 10);
    const rejoinDetectionTimeMs = parseInt(process.env.REJOIN_DETECTION_TIME_MS || '20000', 10);
    const arrivalRadiusKm = parseFloat(process.env.ARRIVAL_RADIUS_KM || '0.5'); // 500 meters

    // 2. Accuracy sanity check
    const isLowAccuracy = accuracy > 100;

    // Maintain a rolling history buffer of recent GPS coordinates (last 10 updates)
    const currentPoint = { latitude, longitude, speed, heading, accuracy, timestamp };
    buffer.lastLocations.push(currentPoint);
    if (buffer.lastLocations.length > 10) {
      buffer.lastLocations.shift();
    }

    // 3. DESTINATION ARRIVAL STATE MACHINE
    let distToDestinationKm = Infinity;
    if (trip.destination_lat && trip.destination_lng) {
      distToDestinationKm = haversineDistanceKm(latitude, longitude, trip.destination_lat, trip.destination_lng);
    }

    const isNearDestination = distToDestinationKm <= arrivalRadiusKm;

    if (isNearDestination && !buffer.isArrivedEmitted && !isLowAccuracy) {
      buffer.currentStatus = 'ARRIVED';
      buffer.isArrivedEmitted = true;
      buffer.arrivedAt = new Date(timestamp).toISOString();

      // Generate MEMBER_ARRIVED Event
      const arrivalEvent = {
        id: uuidv4(),
        trip_id: tripId,
        user_id: userId,
        user_name: userName,
        user_image: userImage,
        event_type: 'MEMBER_ARRIVED',
        latitude,
        longitude,
        location_name: trip.destination,
        metadata: {
          destination: trip.destination,
          arrivedAt: buffer.arrivedAt,
          message: `${userName} arrived at ${trip.destination}`
        },
        created_at: new Date().toISOString()
      };
      db.tables.insert('trip_events', arrivalEvent);
      generatedEvents.push(arrivalEvent);

      // Check if ALL travelers have now arrived
      const tripMembers = db.tables.get('trip_members').filter(tm => tm.trip_id === tripId);
      const allTripLocations = await redisStore.hgetall(`trip:${tripId}:locations`);
      
      let allMembersHaveArrived = false;
      let totalTravelersCount = 0;

      if (tripMembers && tripMembers.length > 0) {
        totalTravelersCount = tripMembers.length;
        allMembersHaveArrived = tripMembers.every(tm => {
          if (tm.user_id === userId) return true; // current user is arriving now
          const loc = allTripLocations[tm.user_id];
          return loc && loc.status === 'ARRIVED';
        });
      } else {
        const activeLocationsList = Object.values(allTripLocations || {});
        totalTravelersCount = activeLocationsList.length;
        allMembersHaveArrived = activeLocationsList.length >= 2 && activeLocationsList.every(l => {
          if (l.userId === userId) return true;
          return l.status === 'ARRIVED';
        });
      }

      if (allMembersHaveArrived) {
        const existingAllArrived = db.tables.get('trip_events').find(
          e => e.trip_id === tripId && e.event_type === 'ALL_MEMBERS_ARRIVED'
        );

        if (!existingAllArrived) {
          const allArrivedEvent = {
            id: uuidv4(),
            trip_id: tripId,
            event_type: 'ALL_MEMBERS_ARRIVED',
            latitude,
            longitude,
            location_name: trip.destination,
            metadata: {
              destination: trip.destination,
              totalTravelers: totalTravelersCount,
              message: `All ${totalTravelersCount} travelers have reached ${trip.destination}!`
            },
            created_at: new Date().toISOString()
          };
          db.tables.insert('trip_events', allArrivedEvent);
          generatedEvents.push(allArrivedEvent);
        }
      }
    } else if (!isNearDestination && buffer.currentStatus === 'ARRIVED') {
      // Revert from ARRIVED if traveler jumps away from destination (e.g. simulation reset)
      buffer.currentStatus = isSpeedStationary ? 'STOPPED' : 'MOVING';
      buffer.isArrivedEmitted = false;
      buffer.arrivedAt = null;
    }

    // 4. STOP DETECTION & 10-MINUTE STATIONARY STOP ENGINE
    // Speed threshold < 3.0 km/h and spatial drift < 50 meters
    const isSpeedStationary = speed < 3.0;
    
    // Calculate maximum displacement across recent stationary points
    let maxDisplacementMeters = 0;
    const stationaryPoints = buffer.lastLocations.filter(p => p.speed < 3.0);
    if (stationaryPoints.length > 1) {
      const anchor = stationaryPoints[0];
      maxDisplacementMeters = haversineDistanceMeters(anchor.latitude, anchor.longitude, latitude, longitude);
    }
    const isSpatialStationary = maxDisplacementMeters < 50;

    if (buffer.currentStatus !== 'ARRIVED') {
      if (isSpeedStationary && isSpatialStationary && !isLowAccuracy) {
        if (!buffer.stopCandidateStartTime) {
          buffer.stopCandidateStartTime = timestamp;
          buffer.currentStatus = 'POSSIBLE_STOP';
        } else {
          const stationaryDuration = timestamp - buffer.stopCandidateStartTime;
          
          // A. Confirm STOPPED threshold
          if (stationaryDuration >= stopTimeThreshold && buffer.currentStatus !== 'STOPPED') {
            buffer.currentStatus = 'STOPPED';
            buffer.activeStopStartTime = buffer.stopCandidateStartTime;
            buffer.activeStopCoords = { latitude, longitude };

            // Reverse geocode place name
            const locationName = await mapService.reverseGeocode(latitude, longitude);
            buffer.activeStopLocationName = locationName;

            // Record stop in database
            const stopRecord = db.tables.insert('stops', {
              trip_id: tripId,
              user_id: userId,
              latitude,
              longitude,
              location_name: locationName,
              started_at: new Date(buffer.activeStopStartTime).toISOString(),
              ended_at: null,
              duration_seconds: 0
            });
            buffer.activeStopId = stopRecord.id;

            // Generate STOP_STARTED Event
            const stopEvent = {
              id: uuidv4(),
              trip_id: tripId,
              user_id: userId,
              user_name: userName,
              user_image: userImage,
              event_type: 'STOP_STARTED',
              latitude,
              longitude,
              location_name: locationName,
              metadata: {
                locationName,
                startedAt: new Date(buffer.activeStopStartTime).toISOString()
              },
              created_at: new Date().toISOString()
            };
            db.tables.insert('trip_events', stopEvent);
            generatedEvents.push(stopEvent);
          }

          // B. 10-Minute Stationary Stop Alert (LONG_STOP)
          if (buffer.activeStopStartTime && (timestamp - buffer.activeStopStartTime >= longStopTimeThreshold)) {
            if (!buffer.isLongStopAlerted) {
              buffer.isLongStopAlerted = true;
              
              // Query nearby Petrol Station and Hotel POIs
              const nearbyPOIs = await mapService.searchNearbyPOIs(latitude, longitude, 1200);
              const nearestPetrol = nearbyPOIs.find(p => p.type === 'petrol') || null;
              const nearestHotel = nearbyPOIs.find(p => p.type === 'hotel') || null;

              const durationMins = Math.max(10, Math.round((timestamp - buffer.activeStopStartTime) / 60000));

              const longStopEvent = {
                id: uuidv4(),
                trip_id: tripId,
                user_id: userId,
                user_name: userName,
                user_image: userImage,
                event_type: 'LONG_STOP',
                latitude,
                longitude,
                location_name: buffer.activeStopLocationName || 'Rest Stop',
                metadata: {
                  locationName: buffer.activeStopLocationName || 'Rest Stop',
                  durationMinutes: durationMins,
                  startedAt: new Date(buffer.activeStopStartTime).toISOString(),
                  nearbyPetrol: nearestPetrol ? { name: nearestPetrol.name, distanceText: nearestPetrol.distanceText } : null,
                  nearbyHotel: nearestHotel ? { name: nearestHotel.name, distanceText: nearestHotel.distanceText } : null,
                  message: `${userName} has stopped for ${durationMins} min at ${buffer.activeStopLocationName || 'Rest Stop'}`
                },
                created_at: new Date().toISOString()
              };
              db.tables.insert('trip_events', longStopEvent);
              generatedEvents.push(longStopEvent);
            }
          }
        }
      } else if ((speed >= 5.0 || maxDisplacementMeters > 75) && !isLowAccuracy) {
        // Movement has resumed!
        if (buffer.currentStatus === 'STOPPED' && buffer.activeStopId) {
          const endedAt = new Date().toISOString();
          const durationSeconds = Math.round((timestamp - buffer.activeStopStartTime) / 1000);
          const durationMinutes = Math.max(1, Math.round(durationSeconds / 60));

          // Update stop in database
          db.tables.update('stops', s => s.id === buffer.activeStopId, {
            ended_at: endedAt,
            duration_seconds: durationSeconds
          });

          // Generate STOP_ENDED Event
          const stopEndEvent = {
            id: uuidv4(),
            trip_id: tripId,
            user_id: userId,
            user_name: userName,
            user_image: userImage,
            event_type: 'STOP_ENDED',
            latitude,
            longitude,
            location_name: buffer.activeStopLocationName,
            metadata: {
              locationName: buffer.activeStopLocationName,
              durationSeconds,
              durationMinutes,
              startedAt: new Date(buffer.activeStopStartTime).toISOString(),
              endedAt
            },
            created_at: new Date().toISOString()
          };
          db.tables.insert('trip_events', stopEndEvent);
          generatedEvents.push(stopEndEvent);

          // Reset stop tracking
          buffer.activeStopId = null;
          buffer.activeStopStartTime = null;
          buffer.activeStopLocationName = null;
          buffer.isLongStopAlerted = false;
        }

        buffer.stopCandidateStartTime = null;
        buffer.currentStatus = 'MOVING';
      }
    }

    // 4.5 OFF-ROUTE DEVIATION DETECTION
    const tripMember = db.tables.get('trip_members').find(tm => tm.trip_id === tripId && tm.user_id === userId);
    let routePolylineStr = tripMember?.assigned_route_polyline || trip.route_polyline;
    
    if (routePolylineStr && buffer.currentStatus !== 'ARRIVED' && !isLowAccuracy) {
      try {
        const polylineArray = JSON.parse(routePolylineStr);
        if (Array.isArray(polylineArray) && polylineArray.length > 1) {
          const distToRouteMeters = distanceToPolylineMeters(latitude, longitude, polylineArray);
          
          if (distToRouteMeters > 500) {
            if (!buffer.isOffRoute) {
              buffer.isOffRoute = true;
              buffer.currentStatus = 'OFF_ROUTE';
              // Could also emit an event here if needed
            } else if (buffer.currentStatus !== 'STOPPED' && buffer.currentStatus !== 'POSSIBLE_STOP') {
              buffer.currentStatus = 'OFF_ROUTE';
            }
          } else if (distToRouteMeters < 300 && buffer.isOffRoute) {
            buffer.isOffRoute = false;
            if (buffer.currentStatus === 'OFF_ROUTE') {
              buffer.currentStatus = isSpeedStationary ? 'STOPPED' : 'MOVING';
            }
          }
        }
      } catch (err) {
        console.warn(`[EventEngine] Failed to parse route polyline for deviation check: ${err.message}`);
      }
    }

    // 5. Update Current Member's Redis State
    const individualEta = mapService.calculateIndividualEta(
      latitude,
      longitude,
      trip.destination_lat,
      trip.destination_lng,
      speed
    );

    // Stop duration calculation in seconds & minutes
    let stopDurationSeconds = 0;
    if (buffer.activeStopStartTime && (buffer.currentStatus === 'STOPPED' || buffer.currentStatus === 'POSSIBLE_STOP')) {
      stopDurationSeconds = Math.max(0, Math.round((timestamp - buffer.activeStopStartTime) / 1000));
    }

    // Total route distance for progress computation
    const hasTripCoordinates = [trip.origin_lat, trip.origin_lng, trip.destination_lat, trip.destination_lng]
      .every(Number.isFinite);
    const totalTripKm = hasTripCoordinates
      ? haversineDistanceKm(trip.origin_lat, trip.origin_lng, trip.destination_lat, trip.destination_lng)
      : 0;
    const progressPct = totalTripKm > 0
      ? Math.max(0, Math.min(100, Math.round(((totalTripKm - distToDestinationKm) / totalTripKm) * 100)))
      : 0;

    const memberLocationState = {
      userId,
      userName,
      userImage,
      latitude,
      longitude,
      accuracy,
      speed: buffer.currentStatus === 'ARRIVED' || buffer.currentStatus === 'STOPPED' ? 0 : Math.round(speed * 10) / 10,
      heading: Math.round(heading),
      timestamp,
      status: buffer.currentStatus,
      isLeader: false, // will be evaluated in centroid loop below
      routeProgress: progressPct,
      arrivedAt: buffer.arrivedAt,
      stoppedLocationName: buffer.activeStopLocationName,
      stoppedSince: buffer.activeStopStartTime ? new Date(buffer.activeStopStartTime).toISOString() : null,
      stopDurationSeconds,
      isLongStop: buffer.isLongStopAlerted,
      eta: buffer.currentStatus === 'ARRIVED' ? 'Arrived' : individualEta.formattedEta,
      distanceToDestinationKm: Math.round(distToDestinationKm * 10) / 10,
      lastSeen: new Date(timestamp).toISOString(),
      isStale: false,
      locationSharing: true
    };

    await redisStore.hset(`trip:${tripId}:locations`, userId, memberLocationState);

    // 6. GROUP CENTROID, CONVOY LEADER & SPLIT / REJOIN ENGINE
    const allLocations = await redisStore.hgetall(`trip:${tripId}:locations`);
    const activeLocations = Object.values(allLocations).filter(loc => {
      if (loc.locationSharing === false) return false;
      if (loc.timestamp > 1000000000000) {
        const ageSeconds = (Date.now() - loc.timestamp) / 1000;
        return ageSeconds < 180;
      }
      return true;
    });

    // A. DETERMINE CONVOY LEADER (Furthest ahead along route among active non-arrived travelers)
    const travelingMembers = activeLocations.filter(loc => loc.status !== 'ARRIVED' && loc.status !== 'OFF_ROUTE' && loc.latitude && loc.longitude);
    let leaderUserId = null;
    let maxProgress = -1;

    if (travelingMembers.length > 0) {
      for (const loc of travelingMembers) {
        const progress = loc.routeProgress !== undefined ? loc.routeProgress : 0;
        if (progress > maxProgress) {
          maxProgress = progress;
          leaderUserId = loc.userId;
        }
      }
    }

    const centroid = calculateCentroid(activeLocations.map(l => ({ latitude: l.latitude, longitude: l.longitude })));

    let groupEta = { formattedEta: 'N/A', totalMinutes: 0 };
    if (centroid) {
      groupEta = mapService.calculateGroupEta(activeLocations, trip.destination_lat, trip.destination_lng);

      // Calculate each member's distance from centroid and evaluate Split/Rejoin & Leader badge
      for (const loc of activeLocations) {
        const distFromCentroidKm = haversineDistanceKm(loc.latitude, loc.longitude, centroid.latitude, centroid.longitude);
        loc.distanceFromGroupKm = Math.round(distFromCentroidKm * 10) / 10;
        loc.isLeader = loc.userId === leaderUserId;

        const memBuffer = getMemberBuffer(tripId, loc.userId);

        if (loc.status !== 'ARRIVED') {
          // Group Split / Falling Behind Detection
          if (distFromCentroidKm >= splitDistanceThreshold && !isLowAccuracy) {
            if (!memBuffer.isSplitAlerted) {
              if (!memBuffer.splitCandidateStartTime) {
                memBuffer.splitCandidateStartTime = timestamp;
              }

              if (timestamp - memBuffer.splitCandidateStartTime >= splitDetectionTimeMs) {
                memBuffer.isSplitAlerted = true;
                memBuffer.splitCandidateStartTime = null;
                memBuffer.currentStatus = 'SPLIT';
                loc.status = 'SPLIT';

                const splitEvent = {
                  id: uuidv4(),
                  trip_id: tripId,
                  user_id: loc.userId,
                  user_name: loc.userName,
                  user_image: loc.userImage,
                  event_type: 'MEMBER_FELL_BEHIND',
                  latitude: loc.latitude,
                  longitude: loc.longitude,
                  metadata: {
                    distanceKm: loc.distanceFromGroupKm,
                    message: `${loc.userName} is ${loc.distanceFromGroupKm} km behind the convoy`
                  },
                  created_at: new Date().toISOString()
                };
                db.tables.insert('trip_events', splitEvent);
                generatedEvents.push(splitEvent);
              }
            }
          } else if (distFromCentroidKm <= rejoinDistanceThreshold) {
            // Rejoin condition
            if (memBuffer.isSplitAlerted) {
              if (!memBuffer.rejoinCandidateStartTime) {
                memBuffer.rejoinCandidateStartTime = timestamp;
              }

              if (timestamp - memBuffer.rejoinCandidateStartTime >= rejoinDetectionTimeMs) {
                memBuffer.isSplitAlerted = false;
                memBuffer.rejoinCandidateStartTime = null;
                memBuffer.lastEmittedRejoinTime = Date.now();
                memBuffer.currentStatus = 'MOVING';
                loc.status = 'REJOINED';

                const rejoinEvent = {
                  id: uuidv4(),
                  trip_id: tripId,
                  user_id: loc.userId,
                  user_name: loc.userName,
                  user_image: loc.userImage,
                  event_type: 'MEMBER_REJOINED',
                  latitude: loc.latitude,
                  longitude: loc.longitude,
                  metadata: {
                    distanceKm: loc.distanceFromGroupKm,
                    message: `${loc.userName} has rejoined the convoy`
                  },
                  created_at: new Date().toISOString()
                };
                db.tables.insert('trip_events', rejoinEvent);
                generatedEvents.push(rejoinEvent);
              }
            }
            memBuffer.splitCandidateStartTime = null;
          } else {
            memBuffer.splitCandidateStartTime = null;
            memBuffer.rejoinCandidateStartTime = null;
          }
        }

        // Save updated distance, leader state and status in Redis
        await redisStore.hset(`trip:${tripId}:locations`, loc.userId, loc);

        if (loc.userId === userId) {
          memberLocationState.distanceFromGroupKm = loc.distanceFromGroupKm;
          memberLocationState.status = loc.status;
          memberLocationState.isLeader = loc.isLeader;
        }
      }
    }

    // 7. Record raw telemetry in historical locations table (throttled)
    db.tables.insert('locations', {
      trip_id: tripId,
      user_id: userId,
      latitude,
      longitude,
      accuracy,
      speed,
      heading,
      recorded_at: new Date(timestamp).toISOString()
    });

    // 8. Get fresh compiled trip locations snapshot
    const latestLocationsMap = await redisStore.hgetall(`trip:${tripId}:locations`);

    return {
      updatedLocation: memberLocationState,
      allLocations: latestLocationsMap,
      groupCenter: centroid,
      groupEta,
      events: generatedEvents
    };
  }
};

export default eventEngine;
