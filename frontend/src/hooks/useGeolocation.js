import { useState, useEffect, useRef } from 'react';
import { getSocket } from '../services/socket.js';
import { useTripStore } from '../store/tripStore.js';
import { useAuthStore } from '../store/authStore.js';
import { enqueueLocation, flushQueue, initQueueCount } from '../utils/locationQueue.js';

export function useGeolocation(tripId) {
  const [gpsStatus, setGpsStatus] = useState('idle'); // 'idle' | 'tracking' | 'error' | 'denied'
  const [gpsError, setGpsError] = useState(null);
  const lastSentTimeRef = useRef(0);
  const watchIdRef = useRef(null);

  const { trip, isSharingLocation } = useTripStore();
  const { user } = useAuthStore();

  useEffect(() => {
    // Only track if trip is ACTIVE and user has sharing enabled
    const shouldTrack = trip && trip.status === 'ACTIVE' && isSharingLocation && user;

    if (!shouldTrack) {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
        setGpsStatus('idle');
      }
      return;
    }

    if (!('geolocation' in navigator)) {
      setGpsStatus('error');
      setGpsError('Geolocation is not supported by your browser.');
      return;
    }

    const socket = getSocket();

    // 1. Initialize queue count in store & attempt flush for leftover previous session data
    initQueueCount(tripId);
    flushQueue(tripId);

    // 2. Setup auto-flush listeners on socket connect and browser online
    const handleSocketConnect = () => {
      flushQueue(tripId);
    };

    const handleBrowserOnline = () => {
      flushQueue(tripId);
    };

    socket.on('connect', handleSocketConnect);
    if (typeof window !== 'undefined') {
      window.addEventListener('online', handleBrowserOnline);
    }

    const options = {
      enableHighAccuracy: true,
      maximumAge: 3000,
      timeout: 10000
    };

    const handleSuccess = (position) => {
      setGpsStatus('tracking');
      setGpsError(null);

      const now = Date.now();
      // Throttle: Send at most once every 3.5 seconds
      if (now - lastSentTimeRef.current < 3500) {
        return;
      }
      lastSentTimeRef.current = now;

      const { latitude, longitude, accuracy, speed, heading } = position.coords;

      // Convert speed from m/s to km/h (if available)
      const speedKmh = speed !== null && speed >= 0 ? (speed * 3.6) : 0;

      const pingData = {
        tripId,
        latitude,
        longitude,
        accuracy: accuracy || 10,
        speed: speedKmh,
        heading: heading || 0,
        timestamp: position.timestamp || now
      };

      const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
      const isSocketConnected = socket && socket.connected;

      // When the socket is disconnected or browser is offline, save to persistent queue
      if (!isSocketConnected || !isOnline) {
        enqueueLocation(tripId, pingData);
      } else {
        // Connected: stream live via socket and flush any pending queue
        socket.emit('location:update', pingData);
        flushQueue(tripId);
      }
    };

    const handleError = (error) => {
      console.warn('[Geolocation] Error:', error.message);
      if (error.code === error.PERMISSION_DENIED) {
        setGpsStatus('denied');
        setGpsError('Location permission denied. Please allow location access to share live GPS.');
      } else if (error.code === error.POSITION_UNAVAILABLE) {
        setGpsStatus('error');
        setGpsError('GPS signal unavailable. Trying to acquire fix...');
      } else if (error.code === error.TIMEOUT) {
        setGpsStatus('error');
        setGpsError('GPS acquisition timed out. Retrying...');
      }
    };

    setGpsStatus('tracking');
    watchIdRef.current = navigator.geolocation.watchPosition(handleSuccess, handleError, options);

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      socket.off('connect', handleSocketConnect);
      if (typeof window !== 'undefined') {
        window.removeEventListener('online', handleBrowserOnline);
      }
    };
  }, [tripId, trip?.status, isSharingLocation, user?.id]);

  return { gpsStatus, gpsError };
}

export default useGeolocation;
