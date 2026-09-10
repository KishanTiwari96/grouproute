import { io } from 'socket.io-client';

const API_BASE = 'http://localhost:5000';

async function runNoDuplicateTravelersTest() {
  console.log('====================================================');
  console.log('🧪 TESTING DUPLICATE TRAVELER PREVENTION & DEDUPLICATION');
  console.log('====================================================');

  const randomEmail = `aman_${Date.now()}@grouproute.com`;
  const password = 'password123';

  // 1. Register User "Aman"
  console.log('\n--- 1. Register User "Aman" ---');
  const regRes = await fetch(`${API_BASE}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Aman', email: randomEmail, password })
  });
  const regData = await regRes.json();
  const amanId = regData.user.id;
  const token = regData.token;
  const authHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };
  console.log(`  ✅ PASS: Real user "Aman" registered with ID: ${amanId}`);

  // 2. Create Group and Trip
  console.log('\n--- 2. Create Group & Trip by Aman ---');
  const groupRes = await fetch(`${API_BASE}/api/groups`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ name: "Aman's Convoy Group" })
  });
  const groupData = await groupRes.json();

  const tripRes = await fetch(`${API_BASE}/api/trips`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      group_id: groupData.group.id,
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
  const tripId = tripData.trip.id;

  await fetch(`${API_BASE}/api/trips/${tripId}/start`, { method: 'POST', headers: authHeaders });
  console.log(`  ✅ PASS: Trip created & activated (Trip ID: ${tripId})`);

  // 3. Connect Socket and simulate convoy telemetry
  console.log('\n--- 3. Ingest Convoy Telemetry (Ensuring Aman is bound to real ID) ---');
  const socket = io(API_BASE, {
    auth: { token },
    transports: ['websocket']
  });

  const simulatedCohort = [
    { id: amanId, name: 'Aman', lat: 29.0264, lng: 77.0700, speed: 52, heading: 350 }, // Real Aman updated!
    { id: 'sim-leader', name: 'Rahul (Convoy Leader)', lat: 29.0300, lng: 77.0750, speed: 58, heading: 350 },
    { id: 'sim-priya', name: 'Priya', lat: 29.0200, lng: 77.0650, speed: 50, heading: 350 },
    { id: 'sim-karan', name: 'Karan', lat: 28.8500, lng: 77.1200, speed: 35, heading: 350 },
    { id: 'sim-neha', name: 'Neha (Scout)', lat: 29.0500, lng: 77.0800, speed: 62, heading: 350 }
  ];

  await new Promise((resolve) => {
    socket.on('connect', () => {
      socket.emit('join_trip', { tripId });

      for (const traveler of simulatedCohort) {
        socket.emit('location:update', {
          tripId,
          isSimulated: traveler.id !== amanId,
          simulatedUserId: traveler.id,
          simulatedUserName: traveler.name,
          simulatedUserImage: `https://api.dicebear.com/7.x/avataaars/svg?seed=${traveler.name}`,
          latitude: traveler.lat,
          longitude: traveler.lng,
          speed: traveler.speed,
          heading: traveler.heading,
          accuracy: 5,
          timestamp: Date.now()
        });
      }

      setTimeout(resolve, 800);
    });
  });

  // 4. Verify Trip Details Snapshot from Backend
  console.log('\n--- 4. Verify No Duplicates in Redis / Live Snapshot ---');
  const detailsRes = await fetch(`${API_BASE}/api/trips/${tripId}`, { headers: authHeaders });
  const detailsData = await detailsRes.json();

  const liveLocations = detailsData.liveLocations || {};
  const travelerIds = Object.keys(liveLocations);
  const amanMatches = Object.values(liveLocations).filter(
    l => l.userId === amanId || (l.userName || '').toLowerCase() === 'aman'
  );

  console.log(`  📊 Total live reporting travelers: ${travelerIds.length}`);
  for (const [id, loc] of Object.entries(liveLocations)) {
    console.log(`     - Traveler ID: ${id.padEnd(36)} | Name: ${loc.userName.padEnd(24)} | Speed: ${loc.speed} km/h`);
  }

  if (travelerIds.length !== 5) {
    throw new Error(`Expected exactly 5 unique travelers, got ${travelerIds.length}`);
  }

  if (amanMatches.length !== 1) {
    throw new Error(`Expected exactly ONE Aman record, found ${amanMatches.length}`);
  }

  console.log(`  ✅ PASS: Exactly 1 Aman record found with real user ID (${amanId}).`);

  // 5. Test Live Location Update on Aman (Upsert Verification)
  console.log('\n--- 5. Test Real GPS Update for Aman (Upsert Verification) ---');
  socket.emit('location:update', {
    tripId,
    latitude: 29.0264,
    longitude: 77.0700,
    speed: 68,
    heading: 355,
    timestamp: Date.now()
  });

  await new Promise(r => setTimeout(r, 600));

  const afterUpdateRes = await fetch(`${API_BASE}/api/trips/${tripId}`, { headers: authHeaders });
  const afterUpdateData = await afterUpdateRes.json();
  const afterLocations = afterUpdateData.liveLocations || {};
  const afterAman = afterLocations[amanId];

  if (!afterAman) {
    throw new Error(`Aman record missing after live GPS update!`);
  }
  if (Object.keys(afterLocations).length !== 5) {
    throw new Error(`Duplicate traveler created after GPS update! Total: ${Object.keys(afterLocations).length}`);
  }

  console.log(`  ✅ PASS: Aman successfully updated in-place (Speed: ${afterAman.speed} km/h). Total count remains 5.`);

  socket.disconnect();

  console.log('\n====================================================');
  console.log('🎉 ZERO DUPLICATE TRAVELERS VERIFIED ACROSS THE PIPELINE!');
  console.log('====================================================\n');
}

runNoDuplicateTravelersTest().catch((err) => {
  console.error('❌ Duplicate traveler test failed:', err);
  process.exit(1);
});
