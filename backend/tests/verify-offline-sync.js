import { io } from 'socket.io-client';

const API_BASE = 'http://localhost:5000';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failed++;
  }
}

async function runOfflineSyncSuite() {
  console.log('================================================================');
  console.log('🧪 VERIFYING OFFLINE LOCATION BATCH SYNC & RESILIENCE ENDPOINT');
  console.log('================================================================\n');

  const randomEmail = `offline_rider_${Date.now()}@grouproute.com`;
  const password = 'password123';

  // 1. Register User
  console.log('--- 1. User Registration ---');
  const regRes = await fetch(`${API_BASE}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Aditya Roy', email: randomEmail, password })
  });
  const regData = await regRes.json();
  assert(regRes.ok && regData.token, `User registered: ${regData.user?.name} (ID: ${regData.user?.id})`);
  const token = regData.token;
  const authHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };

  // 2. Create Group
  console.log('\n--- 2. Create Group ---');
  const groupRes = await fetch(`${API_BASE}/api/groups`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ name: 'Shimla Convoy' })
  });
  const groupData = await groupRes.json();
  assert(groupRes.ok && groupData.group?.id, `Group created: ${groupData.group?.name}`);
  const groupId = groupData.group.id;

  // 3. Create Trip
  console.log('\n--- 3. Create Trip ---');
  const tripRes = await fetch(`${API_BASE}/api/trips`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      group_id: groupId,
      name: 'Delhi to Shimla Highway Run',
      origin: 'Kashmere Gate, Delhi',
      destination: 'The Mall, Shimla',
      origin_lat: 28.6675,
      origin_lng: 77.2285,
      destination_lat: 31.1048,
      destination_lng: 77.1734,
      distance: '345 km',
      estimated_duration: '7h 30m'
    })
  });
  const tripData = await tripRes.json();
  assert(tripRes.ok && tripData.trip?.id, `Trip created: ${tripData.trip?.name} (ID: ${tripData.trip?.id})`);
  const tripId = tripData.trip.id;

  // 4. Start Trip
  console.log('\n--- 4. Start Trip (Activate Convoy) ---');
  const startRes = await fetch(`${API_BASE}/api/trips/${tripId}/start`, {
    method: 'POST',
    headers: authHeaders
  });
  const startData = await startRes.json();
  assert(startRes.ok && startData.trip?.status === 'ACTIVE', `Trip is ACTIVE: ${startData.trip?.status}`);

  // 5. Connect Socket to verify real-time room broadcast
  console.log('\n--- 5. Connect Socket Client for Room Broadcast Verification ---');
  const socket = io(API_BASE, {
    auth: { token },
    transports: ['websocket']
  });

  let socketBroadcastReceived = null;
  await new Promise((resolve) => {
    socket.on('connect', () => {
      socket.emit('join_trip', { tripId });
      socket.on('location:update', (data) => {
        socketBroadcastReceived = data;
      });
      resolve();
    });
  });
  assert(socket.connected, 'Socket connected and joined trip room successfully');

  // 6. Test Empty & Malformed Batch Rejection (HTTP 400)
  console.log('\n--- 6. Test Empty & Malformed Batch Rejection (Expect HTTP 400) ---');

  // 6a. Empty array []
  const emptyArrayRes = await fetch(`${API_BASE}/api/trips/${tripId}/locations/sync`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify([])
  });
  assert(emptyArrayRes.status === 400, `Empty array rejected with HTTP 400 (Status: ${emptyArrayRes.status})`);

  // 6b. Empty object {}
  const emptyObjRes = await fetch(`${API_BASE}/api/trips/${tripId}/locations/sync`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({})
  });
  assert(emptyObjRes.status === 400, `Empty object rejected with HTTP 400 (Status: ${emptyObjRes.status})`);

  // 6c. { locations: [] }
  const emptyLocsRes = await fetch(`${API_BASE}/api/trips/${tripId}/locations/sync`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ locations: [] })
  });
  assert(emptyLocsRes.status === 400, `Empty locations array rejected with HTTP 400 (Status: ${emptyLocsRes.status})`);

  // 6d. Malformed coordinates: latitude > 90
  const invalidCoordRes = await fetch(`${API_BASE}/api/trips/${tripId}/locations/sync`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify([{ latitude: 120.5, longitude: 77.2, timestamp: 1000 }])
  });
  assert(invalidCoordRes.status === 400, `Out-of-range latitude rejected with HTTP 400 (Status: ${invalidCoordRes.status})`);

  // 6e. Missing timestamp
  const missingTsRes = await fetch(`${API_BASE}/api/trips/${tripId}/locations/sync`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify([{ latitude: 28.7, longitude: 77.2 }])
  });
  assert(missingTsRes.status === 400, `Missing timestamp rejected with HTTP 400 (Status: ${missingTsRes.status})`);

  // 7. Test Out-Of-Order Batch Replay (3+ Pings)
  console.log('\n--- 7. Test Out-of-Order Location Updates Batch Processing ---');
  // Define 3 location pings:
  // Point 1: Timestamp 100000 - Early in trip (Delhi exit)
  // Point 2: Timestamp 200000 - Middle of trip (Sonipat)
  // Point 3: Timestamp 300000 - Latest in trip (Panipat)
  const p1 = {
    latitude: 28.7050,
    longitude: 77.1350,
    speed: 45,
    accuracy: 8,
    heading: 350,
    timestamp: 100000
  };
  const p2 = {
    latitude: 28.9950,
    longitude: 77.0200,
    speed: 65,
    accuracy: 6,
    heading: 355,
    timestamp: 200000
  };
  const p3 = {
    latitude: 29.3900,
    longitude: 76.9650,
    speed: 75,
    accuracy: 5,
    heading: 0,
    timestamp: 300000 // Newest timestamp
  };

  // DELIBERATELY SCRAMBLE ORDER: [p2 (middle), p3 (newest), p1 (oldest)]
  const scrambledBatch = [p2, p3, p1];
  console.log(`  Sending batch of 3 scrambled pings with timestamps: [${p2.timestamp}, ${p3.timestamp}, ${p1.timestamp}]`);

  const syncRes = await fetch(`${API_BASE}/api/trips/${tripId}/locations/sync`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify(scrambledBatch)
  });
  const syncData = await syncRes.json();

  // (a) Confirm all get processed
  assert(syncRes.ok === true, `Sync endpoint returned HTTP 200 OK`);
  assert(syncData.success === true, `Response confirms success: true`);
  assert(syncData.syncedCount === 3, `All 3 location updates were processed (syncedCount = ${syncData.syncedCount})`);

  // (b) Confirm final live location reflects the newest-timestamped point (p3)
  assert(
    syncData.latestLocation && syncData.latestLocation.timestamp === 300000,
    `Final returned location has newest timestamp: ${syncData.latestLocation?.timestamp} (Expected: 300000)`
  );
  assert(
    Math.abs(syncData.latestLocation?.latitude - p3.latitude) < 0.0001 &&
    Math.abs(syncData.latestLocation?.longitude - p3.longitude) < 0.0001,
    `Final returned location coordinates match newest point (Panipat: ${syncData.latestLocation?.latitude}, ${syncData.latestLocation?.longitude})`
  );

  // Verify that GET /api/trips/:tripId/locations also confirms newest point in Redis
  const getLocRes = await fetch(`${API_BASE}/api/trips/${tripId}/locations`, { headers: authHeaders });
  const getLocData = await getLocRes.json();
  const currentMemberLoc = getLocData.locations?.[regData.user.id];
  assert(
    currentMemberLoc && currentMemberLoc.timestamp === 300000,
    `Persisted trip state in Redis reflects newest point timestamp (300000)`
  );

  // (c) Wait slightly and verify Socket.IO real-time broadcast
  await new Promise(r => setTimeout(r, 200));
  assert(
    socketBroadcastReceived !== null &&
    socketBroadcastReceived.location?.timestamp === 300000,
    `Trip socket room received real-time 'location:update' broadcast with newest point`
  );

  // 8. Test Object Wrapped Format: { locations: [...] }
  console.log('\n--- 8. Test Object-Wrapped Format: { locations: [...] } ---');
  const p4 = {
    latitude: 29.6850,
    longitude: 76.9900,
    speed: 70,
    accuracy: 5,
    heading: 5,
    timestamp: 400000
  };
  const wrappedSyncRes = await fetch(`${API_BASE}/api/trips/${tripId}/locations/sync`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ locations: [p4] })
  });
  const wrappedSyncData = await wrappedSyncRes.json();
  assert(wrappedSyncRes.ok && wrappedSyncData.syncedCount === 1, `Wrapped object { locations: [...] } processed 1 location`);
  assert(wrappedSyncData.latestLocation?.timestamp === 400000, `Latest location updated to timestamp 400000`);

  socket.disconnect();

  console.log('\n================================================================');
  console.log(`RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runOfflineSyncSuite().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
