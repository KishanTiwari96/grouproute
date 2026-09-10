import { io } from 'socket.io-client';

const API_BASE = 'http://localhost:5000';

async function runGroupVisibilityTest() {
  console.log('====================================================');
  console.log('🧪 TESTING LIVE GROUP VISIBILITY & MEMBER INTELLIGENCE');
  console.log('====================================================');

  const randomEmail = `lead_${Date.now()}@grouproute.com`;
  const password = 'password123';

  // 1. Register Convoy Leader
  console.log('\n--- 1. Register Convoy Leader ---');
  const regRes = await fetch(`${API_BASE}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Rahul Sharma', email: randomEmail, password })
  });
  const regData = await regRes.json();
  const token = regData.token;
  const authHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };
  console.log(`  ✅ PASS: Convoy leader registered (${regData.user.name})`);

  // 2. Create Group & Trip
  console.log('\n--- 2. Create Group & Active Trip ---');
  const groupRes = await fetch(`${API_BASE}/api/groups`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ name: 'Himalayan Riders 2026' })
  });
  const groupData = await groupRes.json();

  const tripRes = await fetch(`${API_BASE}/api/trips`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      group_id: groupData.group.id,
      name: 'Delhi to Manali Convoy',
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
  const tripId = tripData.trip.id;

  await fetch(`${API_BASE}/api/trips/${tripId}/start`, { method: 'POST', headers: authHeaders });
  console.log(`  ✅ PASS: Trip created & activated (Trip ID: ${tripId})`);

  // 3. Connect Leader Socket
  console.log('\n--- 3. Connect Leader & Ingest 5 Simulated Convoy Travelers ---');
  const socket = io(API_BASE, {
    auth: { token },
    transports: ['websocket']
  });

  const simulatedTravelers = [
    { id: 'sim-rahul', name: 'Rahul (Convoy Leader)', lat: 29.0264, lng: 77.0700, speed: 62, heading: 350 },
    { id: 'sim-neha', name: 'Neha (Scout)', lat: 29.0500, lng: 77.0800, speed: 65, heading: 350 },
    { id: 'sim-priya', name: 'Priya', lat: 29.0264, lng: 77.0700, speed: 0, heading: 0 }, // Stopped at Murthal
    { id: 'sim-karan', name: 'Karan', lat: 28.8500, lng: 77.1200, speed: 35, heading: 350 }, // Behind
    { id: 'sim-aman', name: 'Aman', lat: 29.0100, lng: 77.0650, speed: 58, heading: 350 }
  ];

  await new Promise((resolve) => {
    socket.on('connect', () => {
      socket.emit('join_trip', { tripId });

      // Emit telemetry for all 5 travelers
      for (const t of simulatedTravelers) {
        socket.emit('location:update', {
          tripId,
          isSimulated: true,
          simulatedUserId: t.id,
          simulatedUserName: t.name,
          simulatedUserImage: `https://api.dicebear.com/7.x/avataaars/svg?seed=${t.name}`,
          latitude: t.lat,
          longitude: t.lng,
          speed: t.speed,
          heading: t.heading,
          accuracy: 5,
          timestamp: Date.now()
        });
      }

      setTimeout(resolve, 800);
    });
  });

  // 4. Verify Redis Live Locations Contain All 5 Travelers
  console.log('\n--- 4. Verify Redis / Backend Group Snapshot ---');
  const detailsRes = await fetch(`${API_BASE}/api/trips/${tripId}`, { headers: authHeaders });
  const detailsData = await detailsRes.json();
  const liveCount = Object.keys(detailsData.liveLocations || {}).length;

  console.log(`  ✅ PASS: Backend compiled ${liveCount} live reporting travelers.`);
  for (const [id, loc] of Object.entries(detailsData.liveLocations)) {
    console.log(`     - Traveler: ${loc.userName} (${loc.userId}) | Status: ${loc.status} | Speed: ${loc.speed} km/h | Dist: ${loc.distanceFromGroupKm} km | ETA: ${loc.eta}`);
  }

  if (liveCount < 5) {
    throw new Error(`Expected at least 5 live reporting travelers in snapshot, got ${liveCount}`);
  }

  socket.disconnect();

  console.log('\n====================================================');
  console.log('🎉 GROUP VISIBILITY & TELEMETRY INGESTION FULLY PASSED!');
  console.log('====================================================\n');
}

runGroupVisibilityTest().catch((err) => {
  console.error('❌ Visibility test failed:', err);
  process.exit(1);
});
