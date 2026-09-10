import jwt from 'jsonwebtoken';
import db from '../models/db.js';
import redisStore from '../services/redisStore.js';
import eventEngine from '../services/eventEngine.js';

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET must be configured before starting GroupRoute.');
}
const isDemoModeEnabled = () => process.env.DEMO_MODE === 'true';

function getAuthorizedTrip(socket, tripId) {
  if (!tripId || socket.currentTripId !== tripId) return null;

  const trip = db.tables.get('trips').find(t => t.id === tripId);
  if (!trip || trip.status !== 'ACTIVE') return null;

  const isGroupMember = db.tables.get('group_members').some(
    member => member.group_id === trip.group_id && member.user_id === socket.user.id
  );

  return isGroupMember ? trip : null;
}

export function setupSockets(io) {
  // Authentication Middleware for Socket.IO
  io.use((socket, next) => {
    const token = socket.handshake.auth.token || socket.handshake.query.token;

    if (!token) {
      return next(new Error('Authentication error: Token required'));
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      const user = db.tables.get('users').find(u => u.id === decoded.userId);
      if (!user) {
        return next(new Error('Authentication error: User not found'));
      }

      socket.user = {
        id: user.id,
        name: user.name,
        email: user.email,
        profile_image: user.profile_image
      };
      next();
    } catch (err) {
      return next(new Error('Authentication error: Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    const user = socket.user;
    console.log(`[Socket] User connected: ${user.name} (${user.id})`);

    // Handle Join Trip Room
    socket.on('join_trip', async ({ tripId }) => {
      if (!tripId) return;

      const trip = db.tables.get('trips').find(t => t.id === tripId);
      if (!trip) {
        socket.emit('error', { message: 'Trip not found' });
        return;
      }

      // Check group membership
      const isMember = db.tables.get('group_members').some(
        m => m.group_id === trip.group_id && m.user_id === user.id
      );

      if (!isMember) {
        socket.emit('error', { message: 'Unauthorized: Not a group member' });
        return;
      }

      const roomName = `trip:${tripId}`;
      socket.join(roomName);
      socket.currentTripId = tripId;

      console.log(`[Socket] ${user.name} joined room ${roomName}`);

      // Send initial locations snapshot from Redis
      const currentLocations = await redisStore.hgetall(`trip:${tripId}:locations`);
      socket.emit('locations:snapshot', { locations: currentLocations });

      const chatMessages = db.tables.get('chat_messages')
        .filter(message => message.trip_id === tripId)
        .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
        .slice(-100)
        .map(message => ({
          id: message.id,
          userId: message.user_id,
          userName: message.user_name,
          text: message.text,
          createdAt: message.created_at
        }));
      socket.emit('chat:history', { messages: chatMessages });

      // Notify others in the room
      socket.to(roomName).emit('member:joined', {
        user: {
          id: user.id,
          name: user.name,
          profile_image: user.profile_image
        },
        timestamp: new Date().toISOString()
      });
    });

    // Handle Leave Trip Room
    socket.on('leave_trip', ({ tripId }) => {
      const roomName = `trip:${tripId}`;
      socket.leave(roomName);
      socket.currentTripId = null;

      socket.to(roomName).emit('member:left', {
        userId: user.id,
        name: user.name,
        timestamp: new Date().toISOString()
      });
    });

    socket.on('chat:send', ({ tripId, text }) => {
      const cleanText = typeof text === 'string' ? text.trim() : '';
      if (!tripId || tripId !== socket.currentTripId || !cleanText) return;

      const message = {
        id: `${socket.id}-${Date.now()}`,
        trip_id: tripId,
        user_id: user.id,
        user_name: user.name,
        text: cleanText.slice(0, 500),
        created_at: new Date().toISOString()
      };
      db.tables.insert('chat_messages', message);

      io.to(`trip:${tripId}`).emit('chat:message', {
        id: message.id,
        userId: user.id,
        userName: user.name,
        text: message.text,
        createdAt: message.created_at
      });
    });

    // Handle Live Location Update
    socket.on('location:update', async (payload) => {
      try {
        const { tripId, latitude, longitude, accuracy = 10, speed = 0, heading = 0, timestamp = Date.now(), isSimulated = false, simulatedUserId, simulatedUserName, simulatedUserImage } = payload;

        const numericLatitude = Number(latitude);
        const numericLongitude = Number(longitude);
        const numericAccuracy = Number(accuracy);
        const numericSpeed = Number(speed);
        const numericHeading = Number(heading);
        const numericTimestamp = Number(timestamp);

        if (!getAuthorizedTrip(socket, tripId)) {
          socket.emit('error', { message: 'Unauthorized location update.' });
          return;
        }

        if (
          !Number.isFinite(numericLatitude) || !Number.isFinite(numericLongitude) ||
          !Number.isFinite(numericAccuracy) || !Number.isFinite(numericSpeed) ||
          !Number.isFinite(numericHeading) || !Number.isFinite(numericTimestamp) ||
          numericLatitude < -90 || numericLatitude > 90 ||
          numericLongitude < -180 || numericLongitude > 180 ||
          numericAccuracy < 0 || numericSpeed < 0 || numericTimestamp <= 0
        ) {
          socket.emit('error', { message: 'Invalid location update.' });
          return;
        }

        if (!isSimulated && numericTimestamp > Date.now() + 60_000) {
          socket.emit('error', { message: 'Location timestamp cannot be in the future.' });
          return;
        }

        if (isSimulated && !isDemoModeEnabled()) {
          socket.emit('error', { message: 'Simulation is disabled.' });
          return;
        }

        const effectiveUserId = isSimulated && simulatedUserId ? simulatedUserId : user.id;

        const tripMember = db.tables.get('trip_members').find(
          member => member.trip_id === tripId && member.user_id === user.id
        );
        if (!tripMember || tripMember.location_sharing === false) {
          socket.emit('error', { message: 'Location sharing is disabled for this trip.' });
          return;
        }

        if (isSimulated && (typeof simulatedUserId !== 'string' || !simulatedUserId.startsWith('sim-'))) {
          socket.emit('error', { message: 'Invalid simulated user.' });
          return;
        }

        // If simulated user doesn't exist in users table, insert a temporary record so foreign keys resolve
        if (isSimulated && simulatedUserId) {
          const exists = db.tables.get('users').find(u => u.id === simulatedUserId);
          if (!exists) {
            db.tables.insert('users', {
              id: simulatedUserId,
              name: simulatedUserName || 'Simulated User',
              email: `sim_${simulatedUserId}@grouproute.internal`,
              password_hash: 'sim_hash',
              profile_image: simulatedUserImage || `https://api.dicebear.com/7.x/avataaars/svg?seed=${simulatedUserId}`
            });
          }
        }

        // Process telemetry through Location Intelligence Engine
        const result = await eventEngine.processLocationUpdate({
          tripId,
          userId: effectiveUserId,
          latitude: numericLatitude,
          longitude: numericLongitude,
          accuracy: numericAccuracy,
          speed: numericSpeed,
          heading: numericHeading,
          timestamp: numericTimestamp
        });

        // Broadcast via reusable telemetry broadcaster
        broadcastTripTelemetry(io, tripId, result, result.events);
      } catch (err) {
        console.error('[Socket] location:update error:', err.message);
      }
    });

    // Handle Location Sharing Toggle ON
    socket.on('location:sharing:start', async ({ tripId }) => {
      if (!getAuthorizedTrip(socket, tripId)) {
        socket.emit('error', { message: 'Unauthorized location sharing update.' });
        return;
      }
      db.tables.update('trip_members', tm => tm.trip_id === tripId && tm.user_id === user.id, {
        location_sharing: true,
        sharing_started_at: new Date().toISOString()
      });

      // Update redis status
      let existing = await redisStore.hget(`trip:${tripId}:locations`, user.id);
      if (typeof existing === 'string') {
        try { existing = JSON.parse(existing); } catch (e) { existing = null; }
      }
      if (existing && typeof existing === 'object') {
        existing.locationSharing = true;
        await redisStore.hset(`trip:${tripId}:locations`, user.id, existing);
      }

      const roomName = `trip:${tripId}`;
      io.to(roomName).emit('member:status_changed', {
        userId: user.id,
        locationSharing: true,
        status: 'MOVING'
      });
    });

    // Handle Location Sharing Toggle OFF
    socket.on('location:sharing:stop', async ({ tripId }) => {
      if (!getAuthorizedTrip(socket, tripId)) {
        socket.emit('error', { message: 'Unauthorized location sharing update.' });
        return;
      }
      db.tables.update('trip_members', tm => tm.trip_id === tripId && tm.user_id === user.id, {
        location_sharing: false,
        sharing_ended_at: new Date().toISOString()
      });

      // Update redis status
      let existing = await redisStore.hget(`trip:${tripId}:locations`, user.id);
      if (typeof existing === 'string') {
        try { existing = JSON.parse(existing); } catch (e) { existing = null; }
      }
      if (existing && typeof existing === 'object') {
        existing.locationSharing = false;
        existing.status = 'LOCATION_OFF';
        await redisStore.hset(`trip:${tripId}:locations`, user.id, existing);
      }

      const roomName = `trip:${tripId}`;
      io.to(roomName).emit('member:status_changed', {
        userId: user.id,
        locationSharing: false,
        status: 'LOCATION_OFF'
      });
    });

    // Disconnect handler
    socket.on('disconnect', () => {
      console.log(`[Socket] User disconnected: ${user.name} (${user.id})`);
      if (socket.currentTripId) {
        const roomName = `trip:${socket.currentTripId}`;
        socket.to(roomName).emit('member:status_changed', {
          userId: user.id,
          status: 'OFFLINE'
        });
      }
    });
  });
}

/**
 * Reusable broadcast function for trip telemetry updates.
 * Dispatches location:update, trip:state, and generated travel events (stops, splits, rejoins, arrivals)
 * to the trip room.
 */
export function broadcastTripTelemetry(io, tripId, result, events = []) {
  if (!io || !tripId || !result) return;
  const roomName = `trip:${tripId}`;

  // Broadcast single location update
  if (result.updatedLocation && result.allLocations) {
    io.to(roomName).emit('location:update', {
      location: result.updatedLocation,
      allLocations: result.allLocations
    });
  }

  // Broadcast group state (center, ETA)
  if (result.groupCenter !== undefined) {
    io.to(roomName).emit('trip:state', {
      groupCenter: result.groupCenter,
      groupEta: result.groupEta
    });
  }

  // Broadcast any generated travel events (Stop Started/Ended, Split, Rejoin, Arrived)
  const evList = events && events.length > 0 ? events : (result.events || []);
  if (evList.length > 0) {
    for (const ev of evList) {
      io.to(roomName).emit('trip:event', ev);

      if (ev.event_type === 'STOP_STARTED') {
        io.to(roomName).emit('stop:started', ev);
      } else if (ev.event_type === 'STOP_ENDED') {
        io.to(roomName).emit('stop:ended', ev);
      } else if (ev.event_type === 'MEMBER_FELL_BEHIND' || ev.event_type === 'GROUP_SPLIT') {
        io.to(roomName).emit('member:behind', ev);
        io.to(roomName).emit('group:split', ev);
      } else if (ev.event_type === 'MEMBER_REJOINED') {
        io.to(roomName).emit('member:rejoined', ev);
      }
    }
  }
}

export default setupSockets;

