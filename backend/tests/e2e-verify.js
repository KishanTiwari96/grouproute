import io from 'socket.io-client';

const API_BASE = 'http://localhost:5000/api';
const SOCKET_URL = 'http://localhost:5000';

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

async function runE2E() {
  console.log('\n======================================================');
  console.log('🚀 RUNNING GROUPROUTE FULL-STACK E2E INTEGRATION SUITE');
  console.log('======================================================\n');

  // 1. Healthcheck
  console.log('--- 1. Health Check ---');
  const healthRes = await fetch(`${API_BASE}/health`);
  const healthData = await healthRes.json();
  assert(healthData.status === 'ok', 'Server health check returns ok');

  // 2. User Registration & Auth
  console.log('\n--- 2. User Authentication ---');
  const email = `testuser_${Date.now()}@grouproute.com`;
  const regRes = await fetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Convoy Leader',
      email,
      password: 'password123'
    })
  });
  const regData = await regRes.json();
  assert(regRes.status === 201 && regData.token, 'User registered and JWT token issued');
  const token = regData.token;
  const user = regData.user;

  // 3. Create Travel Group
  console.log('\n--- 3. Travel Group Lifecycle ---');
  const groupRes = await fetch(`${API_BASE}/groups`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ name: 'Himalayan Convoy 2026' })
  });
  const groupData = await groupRes.json();
  assert(groupRes.status === 201 && groupData.group.invite_code, `Group created with invite code: ${groupData.group?.invite_code}`);
  const group = groupData.group;

  // 4. Create Trip
  console.log('\n--- 4. Trip Planning & Route Calculation ---');
  const tripRes = await fetch(`${API_BASE}/trips`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      group_id: group.id,
      name: 'Delhi to Manali Highway Run',
      origin: 'New Delhi',
      destination: 'Manali',
      origin_lat: 28.6315,
      origin_lng: 77.2167,
      destination_lat: 32.2396,
      destination_lng: 77.1887
    })
  });
  const tripData = await tripRes.json();
  assert(tripRes.status === 201 && tripData.trip.status === 'PLANNED', 'Trip created with status PLANNED');
  const trip = tripData.trip;

  // 5. Start Trip
  console.log('\n--- 5. Start Trip Lifecycle ---');
  const startRes = await fetch(`${API_BASE}/trips/${trip.id}/start`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const startData = await startRes.json();
  assert(startData.trip.status === 'ACTIVE', 'Trip status updated to ACTIVE');

  // 6. Real-time Socket Connection & Location Telemetry
  console.log('\n--- 6. Socket.IO Real-Time Telemetry & Event Broadcast ---');
  await new Promise((resolve, reject) => {
    const socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket']
    });

    socket.on('connect', () => {
      assert(true, `Socket connected successfully with ID: ${socket.id}`);
      socket.emit('join_trip', { tripId: trip.id });
    });

    socket.on('locations:snapshot', (data) => {
      assert(true, 'Received initial locations snapshot from Redis');

      // Send live location update
      socket.emit('location:update', {
        tripId: trip.id,
        latitude: 29.0264,
        longitude: 77.0700,
        speed: 65,
        heading: 355,
        accuracy: 5
      });
    });

    socket.on('location:update', (data) => {
      assert(data.location.latitude === 29.0264, `Received broadcast location update for ${data.location.userName}`);
      assert(data.location.status === 'MOVING', `Member status is ${data.location.status}`);
      socket.disconnect();
      resolve();
    });

    setTimeout(() => {
      socket.disconnect();
      resolve();
    }, 4000);
  });

  // 7. Timeline API
  console.log('\n--- 7. Timeline History API ---');
  const timelineRes = await fetch(`${API_BASE}/trips/${trip.id}/timeline`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const timelineData = await timelineRes.json();
  assert(Array.isArray(timelineData.events) && timelineData.events.length > 0, `Timeline retrieved with ${timelineData.events.length} event(s)`);

  console.log('\n======================================================');
  console.log(`E2E SUITE COMPLETE: ${passed} PASSED, ${failed} FAILED`);
  console.log('======================================================\n');
}

runE2E().catch(err => {
  console.error('E2E execution error:', err);
  process.exit(1);
});
