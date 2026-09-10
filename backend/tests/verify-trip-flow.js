import { io } from 'socket.io-client';

const API_BASE = 'http://localhost:5000';

async function runCompleteFlowTest() {
  console.log('====================================================');
  console.log('🧪 TESTING COMPLETE USER FLOW: CREATE GROUP -> CREATE TRIP -> LIVE MAP');
  console.log('====================================================');

  const randomEmail = `tripuser_${Date.now()}@grouproute.com`;
  const password = 'password123';

  // 1. Register User
  console.log('\n--- 1. User Registration ---');
  const regRes = await fetch(`${API_BASE}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Vikram Singh', email: randomEmail, password })
  });
  const regData = await regRes.json();
  if (!regRes.ok || !regData.token) {
    throw new Error(`Registration failed: ${regData.error}`);
  }
  console.log(`  ✅ PASS: User registered (${regData.user.name}) with JWT token.`);

  const token = regData.token;
  const authHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };

  // 2. Check Initial Groups (Should be 0)
  console.log('\n--- 2. Initial Groups Query ---');
  const initialGroupsRes = await fetch(`${API_BASE}/api/groups`, { headers: authHeaders });
  const initialGroupsData = await initialGroupsRes.json();
  console.log(`  ✅ PASS: Initial groups count: ${initialGroupsData.groups.length}`);

  // 3. Create Group in Flow
  console.log('\n--- 3. Create Group ---');
  const groupRes = await fetch(`${API_BASE}/api/groups`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ name: 'Ladakh Riders Convoy' })
  });
  const groupData = await groupRes.json();
  if (!groupRes.ok || !groupData.group) {
    throw new Error(`Group creation failed: ${groupData.error}`);
  }
  console.log(`  ✅ PASS: Group created (${groupData.group.name}, ID: ${groupData.group.id}, Code: ${groupData.group.invite_code})`);

  // 4. Verify Group Appears in User Groups
  console.log('\n--- 4. Verify Group in Select List ---');
  const groupsRes = await fetch(`${API_BASE}/api/groups`, { headers: authHeaders });
  const groupsData = await groupsRes.json();
  const foundGroup = groupsData.groups.find(g => g.id === groupData.group.id);
  if (!foundGroup) {
    throw new Error('Created group not found in user groups list.');
  }
  console.log(`  ✅ PASS: Group "${foundGroup.name}" is listed and ready for selection.`);

  // 5. Create Trip with Group ID
  console.log('\n--- 5. Create Trip Flow ---');
  const tripRes = await fetch(`${API_BASE}/api/trips`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      group_id: foundGroup.id,
      name: 'Delhi to Manali Expedition',
      origin: 'Connaught Place, New Delhi',
      destination: 'Mall Road, Manali, Himachal Pradesh',
      origin_lat: 28.6315,
      origin_lng: 77.2167,
      destination_lat: 32.2396,
      destination_lng: 77.1887,
      distance: '535 km',
      estimated_duration: '11h 30m'
    })
  });
  const tripData = await tripRes.json();
  if (!tripRes.ok || !tripData.trip || !tripData.trip.id) {
    throw new Error(`Trip creation failed: ${tripData.error}`);
  }
  console.log(`  ✅ PASS: Trip created successfully (ID: ${tripData.trip.id}, Status: ${tripData.trip.status})`);

  // 6. Start Trip Flow
  console.log('\n--- 6. Activate Trip for Live Convoy Tracking ---');
  const startRes = await fetch(`${API_BASE}/api/trips/${tripData.trip.id}/start`, {
    method: 'POST',
    headers: authHeaders
  });
  const startData = await startRes.json();
  if (!startRes.ok || startData.trip.status !== 'ACTIVE') {
    throw new Error(`Trip activation failed: ${startData.error}`);
  }
  console.log(`  ✅ PASS: Trip is now ACTIVE (Event: ${startData.event.event_type})`);

  // 7. Fetch Trip Details (TripDashboard Initial Load)
  console.log('\n--- 7. Trip Dashboard Hydration ---');
  const detailsRes = await fetch(`${API_BASE}/api/trips/${tripData.trip.id}`, { headers: authHeaders });
  const detailsData = await detailsRes.json();
  if (!detailsRes.ok || !detailsData.trip) {
    throw new Error(`Trip details fetch failed: ${detailsData.error}`);
  }
  console.log(`  ✅ PASS: Trip details loaded:`);
  console.log(`     - Trip Name: ${detailsData.trip.name}`);
  console.log(`     - Origin: ${detailsData.trip.origin} (${detailsData.trip.origin_lat}, ${detailsData.trip.origin_lng})`);
  console.log(`     - Destination: ${detailsData.trip.destination} (${detailsData.trip.destination_lat}, ${detailsData.trip.destination_lng})`);
  console.log(`     - Members Count: ${detailsData.members.length}`);
  console.log(`     - Is Owner: ${detailsData.isOwner}`);

  // 8. Connect Socket.IO and Send Live Telemetry
  console.log('\n--- 8. Live Socket.IO Tracking ---');
  const socket = io(API_BASE, {
    auth: { token },
    transports: ['websocket']
  });

  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Socket timeout')), 5000);

    socket.on('connect', () => {
      console.log(`  ✅ PASS: Socket connected (Socket ID: ${socket.id})`);
      socket.emit('join_trip', { tripId: tripData.trip.id });

      // Send telemetry point
      socket.emit('location:update', {
        tripId: tripData.trip.id,
        latitude: 28.6315,
        longitude: 77.2167,
        accuracy: 5,
        speed: 55,
        heading: 350,
        timestamp: Date.now()
      });
    });

    socket.on('location:update', (data) => {
      console.log(`  ✅ PASS: Telemetry broadcast received for member: ${data.location.userName || data.location.userId}, Speed: ${data.location.speed} km/h`);
      clearTimeout(timeout);
      socket.disconnect();
      resolve();
    });
  });

  console.log('\n====================================================');
  console.log('🎉 COMPLETE CREATE TRIP & LIVE MAP FLOW FULLY VERIFIED!');
  console.log('====================================================\n');
}

runCompleteFlowTest().catch((err) => {
  console.error('❌ Flow test failed:', err);
  process.exit(1);
});
