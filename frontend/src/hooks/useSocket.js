import { useEffect } from 'react';
import { getSocket, connectSocket } from '../services/socket.js';
import { useTripStore } from '../store/tripStore.js';

export function useSocket(tripId) {
  const {
    setLiveLocations,
    updateMemberLocation,
    setGroupCenterAndEta,
    addEvent,
    addStop,
    updateStop,
    updateMemberStatus,
    setConnectionStatus,
    addChatMessage,
    setChatMessages
  } = useTripStore();

  useEffect(() => {
    if (!tripId) return;

    const socket = getSocket();

    function onConnect() {
      setConnectionStatus('connected');
      socket.emit('join_trip', { tripId });
    }

    function onDisconnect(reason) {
      if (reason === 'io server disconnect' || reason === 'io client disconnect') {
        setConnectionStatus('disconnected');
      } else {
        setConnectionStatus('reconnecting');
      }
    }

    function onReconnectAttempt() {
      setConnectionStatus('reconnecting');
    }

    function onReconnectFailed() {
      setConnectionStatus('disconnected');
    }

    function onLocationsSnapshot(data) {
      if (data && data.locations) {
        setLiveLocations(data.locations);
      }
    }

    function onLocationUpdate(data) {
      if (data && data.location) {
        updateMemberLocation(data.location);
      }
      if (data && data.allLocations) {
        setLiveLocations(data.allLocations);
      }
    }

    function onTripState(data) {
      if (data) {
        setGroupCenterAndEta(data.groupCenter, data.groupEta);
      }
    }

    function onTripEvent(event) {
      if (event) {
        addEvent(event);
      }
    }

    function onStopStarted(event) {
      if (event) {
        addStop({
          id: event.metadata?.stopId || `stop-${Date.now()}`,
          trip_id: tripId,
          user_id: event.user_id,
          user_name: event.user_name,
          latitude: event.latitude,
          longitude: event.longitude,
          location_name: event.location_name || event.metadata?.locationName || 'Unknown Location',
          started_at: event.metadata?.startedAt || event.created_at,
          duration_seconds: 0
        });
      }
    }

    function onStopEnded(event) {
      if (event) {
        updateStop({
          id: event.metadata?.stopId,
          user_id: event.user_id,
          location_name: event.location_name || event.metadata?.locationName,
          ended_at: event.metadata?.endedAt || event.created_at,
          duration_seconds: event.metadata?.durationSeconds || 0
        });
      }
    }

    function onMemberStatusChanged(data) {
      if (data && data.userId) {
        updateMemberStatus(data.userId, data.status, data.locationSharing);
      }
    }

    function onChatMessage(message) {
      if (message) addChatMessage(message);
    }

    function onChatHistory(data) {
      if (data && Array.isArray(data.messages)) setChatMessages(data.messages);
    }

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('reconnect_attempt', onReconnectAttempt);
    socket.on('reconnect_failed', onReconnectFailed);
    socket.on('locations:snapshot', onLocationsSnapshot);
    socket.on('location:update', onLocationUpdate);
    socket.on('trip:state', onTripState);
    socket.on('trip:event', onTripEvent);
    socket.on('stop:started', onStopStarted);
    socket.on('stop:ended', onStopEnded);
    socket.on('member:status_changed', onMemberStatusChanged);
    socket.on('chat:message', onChatMessage);
    socket.on('chat:history', onChatHistory);

    if (socket.connected) {
      socket.emit('join_trip', { tripId });
    } else {
      connectSocket();
    }

    return () => {
      socket.emit('leave_trip', { tripId });
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('reconnect_attempt', onReconnectAttempt);
      socket.off('reconnect_failed', onReconnectFailed);
      socket.off('locations:snapshot', onLocationsSnapshot);
      socket.off('location:update', onLocationUpdate);
      socket.off('trip:state', onTripState);
      socket.off('trip:event', onTripEvent);
      socket.off('stop:started', onStopStarted);
      socket.off('stop:ended', onStopEnded);
      socket.off('member:status_changed', onMemberStatusChanged);
      socket.off('chat:message', onChatMessage);
      socket.off('chat:history', onChatHistory);
    };
  }, [tripId]);
}

export default useSocket;
