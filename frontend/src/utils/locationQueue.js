import api from '../services/api.js';
import useTripStore from '../store/tripStore.js';

const MAX_QUEUE_SIZE = 200;

/**
 * Reads queued location pings for a specific trip from localStorage.
 */
export function getQueue(tripId) {
  if (!tripId) return [];
  try {
    const raw = localStorage.getItem(`grouproute_offline_locations_${tripId}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.warn('[LocationQueue] Error reading from localStorage:', e);
    return [];
  }
}

/**
 * Saves queue to localStorage and syncs count with Zustand store.
 */
function saveQueue(tripId, queue) {
  if (!tripId) return;
  try {
    if (!queue || queue.length === 0) {
      localStorage.removeItem(`grouproute_offline_locations_${tripId}`);
    } else {
      localStorage.setItem(`grouproute_offline_locations_${tripId}`, JSON.stringify(queue));
    }
    useTripStore.getState().setOfflineQueueCount(queue ? queue.length : 0);
  } catch (e) {
    console.warn('[LocationQueue] Error saving to localStorage:', e);
  }
}

/**
 * Appends a new GPS position ping to the persistent offline queue.
 * Caps at 200 entries, dropping the oldest entries first if exceeded.
 */
export function enqueueLocation(tripId, ping) {
  if (!tripId || !ping) return 0;
  let queue = getQueue(tripId);

  const entry = {
    latitude: ping.latitude !== undefined ? ping.latitude : ping.lat,
    longitude: ping.longitude !== undefined ? ping.longitude : ping.lng,
    accuracy: ping.accuracy !== undefined ? ping.accuracy : 10,
    speed: ping.speed !== undefined ? ping.speed : 0,
    heading: ping.heading !== undefined ? ping.heading : 0,
    timestamp: ping.timestamp || Date.now()
  };

  queue.push(entry);

  // If cap of 200 is hit, drop oldest entries first
  if (queue.length > MAX_QUEUE_SIZE) {
    queue = queue.slice(queue.length - MAX_QUEUE_SIZE);
  }

  saveQueue(tripId, queue);
  return queue.length;
}

/**
 * Clears sent batch from localStorage. If new pings arrived while flush was in flight,
 * those newer pings are preserved.
 */
export function clearQueue(tripId, sentBatch = null) {
  if (!tripId) return;
  if (!sentBatch || sentBatch.length === 0) {
    saveQueue(tripId, []);
    return;
  }

  const currentQueue = getQueue(tripId);
  const sentTimestamps = new Set(sentBatch.map(p => p.timestamp));
  const remaining = currentQueue.filter(p => !sentTimestamps.has(p.timestamp));
  saveQueue(tripId, remaining);
}

let isFlushing = false;

/**
 * Flushes all queued location updates for a trip via HTTP POST batch endpoint.
 * Leaves queue intact on failure for the next attempt.
 */
export async function flushQueue(tripId) {
  if (!tripId || isFlushing) return;

  const queue = getQueue(tripId);
  if (queue.length === 0) {
    useTripStore.getState().setOfflineQueueCount(0);
    return;
  }

  // If native browser reports offline, wait for online event
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return;
  }

  isFlushing = true;
  const batchToSend = [...queue];

  try {
    const response = await api.syncLocations(tripId, batchToSend);
    if (response && response.success) {
      // Clear confirmed items on success
      clearQueue(tripId, batchToSend);

      // Update local store with latest resolved live state
      const store = useTripStore.getState();
      if (response.latestLocation) {
        store.updateMemberLocation(response.latestLocation);
      }
      if (response.events && Array.isArray(response.events)) {
        for (const ev of response.events) {
          store.addEvent(ev);
        }
      }
      console.log(`[LocationQueue] Successfully synced ${batchToSend.length} offline ping(s) for trip ${tripId}`);
    }
  } catch (err) {
    console.warn('[LocationQueue] Flush failed, leaving queue intact for next reconnect:', err.message);
  } finally {
    isFlushing = false;
  }
}

/**
 * Initializes offline queue count from localStorage into Zustand store on mount.
 */
export function initQueueCount(tripId) {
  if (!tripId) return;
  const queue = getQueue(tripId);
  useTripStore.getState().setOfflineQueueCount(queue.length);
}

export default {
  getQueue,
  enqueueLocation,
  clearQueue,
  flushQueue,
  initQueueCount
};
