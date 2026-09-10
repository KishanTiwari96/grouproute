import { parseDistanceKm } from '../src/controllers/tripController.js';

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

async function runTripHistoryStatsSuite() {
  console.log('================================================================');
  console.log('🧪 VERIFYING TRIP HISTORY & STATS DASHBOARD INTEGRATION SUITE');
  console.log('================================================================\n');

  // 1. Test parseDistanceKm helper unit functionality
  console.log('--- 1. parseDistanceKm Unit Tests ---');
  assert(parseDistanceKm('535 km') === 535, 'parseDistanceKm("535 km") returns 535');
  assert(parseDistanceKm('120.5 km') === 120.5, 'parseDistanceKm("120.5 km") returns 120.5');
  assert(parseDistanceKm('310 km') === 310, 'parseDistanceKm("310 km") returns 310');
  assert(parseDistanceKm('') === 0, 'parseDistanceKm("") returns 0');
  assert(parseDistanceKm(null) === 0, 'parseDistanceKm(null) returns 0');
  assert(parseDistanceKm(undefined) === 0, 'parseDistanceKm(undefined) returns 0');
  assert(parseDistanceKm('invalid text') === 0, 'parseDistanceKm("invalid text") returns 0');
  assert(parseDistanceKm(150) === 150, 'parseDistanceKm(150) numeric returns 150');

  // 2. Register User A (Trip Owner) and User B (Companion)
  console.log('\n--- 2. Register Users ---');
  const userAEmail = `owner_${Date.now()}@grouproute.com`;
  const userBEmail = `companion_${Date.now()}@grouproute.com`;
  const password = 'password123';

  const regARes = await fetch(`${API_BASE}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Vikram Malhotra', email: userAEmail, password })
  });
  const regAData = await regARes.json();
  assert(regARes.ok && regAData.token, `User A registered (ID: ${regAData.user?.id})`);

  const regBRes = await fetch(`${API_BASE}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Sneha Kapur', email: userBEmail, password })
  });
  const regBData = await regBRes.json();
  assert(regBRes.ok && regBData.token, `User B registered (ID: ${regBData.user?.id})`);

  const authAHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${regAData.token}`
  };

  const authBHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${regBData.token}`
  };

  // 3. User A creates group, User B joins group
  console.log('\n--- 3. Create and Join Group ---');
  const grpRes = await fetch(`${API_BASE}/api/groups`, {
    method: 'POST',
    headers: authAHeaders,
    body: JSON.stringify({ name: 'Himalayan Wanderers' })
  });
  const grpData = await grpRes.json();
  assert(grpRes.ok && grpData.group?.invite_code, `Group created with invite code: ${grpData.group?.invite_code}`);

  const joinRes = await fetch(`${API_BASE}/api/groups/join`, {
    method: 'POST',
    headers: authBHeaders,
    body: JSON.stringify({ invite_code: grpData.group.invite_code })
  });
  const joinData = await joinRes.json();
  assert(joinRes.ok && joinData.group, `User B successfully joined group ${joinData.group?.name}`);

  // 4. Create and Complete Trip 1 (120 km)
  console.log('\n--- 4. Create & Complete Trip 1 (120 km) ---');
  const trip1Res = await fetch(`${API_BASE}/api/trips`, {
    method: 'POST',
    headers: authAHeaders,
    body: JSON.stringify({
      group_id: grpData.group.id,
      name: 'Chandigarh Highway Run',
      origin: 'Kashmere Gate, Delhi',
      destination: 'Sector 17, Chandigarh',
      origin_lat: 28.6675,
      origin_lng: 77.2285,
      destination_lat: 30.7333,
      destination_lng: 76.7794,
      distance: '120 km',
      estimated_duration: '2h 30m'
    })
  });
  const trip1Data = await trip1Res.json();
  const trip1Id = trip1Data.trip.id;
  assert(trip1Res.ok && trip1Id, `Trip 1 created (ID: ${trip1Id}, Distance: 120 km)`);

  // User B accesses Trip 1 to join trip_members
  const t1DetailsRes = await fetch(`${API_BASE}/api/trips/${trip1Id}`, { headers: authBHeaders });
  assert(t1DetailsRes.ok, `User B joined trip_members for Trip 1`);

  // Start & Complete Trip 1
  await fetch(`${API_BASE}/api/trips/${trip1Id}/start`, { method: 'POST', headers: authAHeaders });
  const end1Res = await fetch(`${API_BASE}/api/trips/${trip1Id}/end`, { method: 'POST', headers: authAHeaders });
  const end1Data = await end1Res.json();
  assert(end1Res.ok && end1Data.trip?.status === 'COMPLETED', `Trip 1 status is COMPLETED`);

  // 5. Create and Complete Trip 2 (310 km)
  console.log('\n--- 5. Create & Complete Trip 2 (310 km) ---');
  const trip2Res = await fetch(`${API_BASE}/api/trips`, {
    method: 'POST',
    headers: authAHeaders,
    body: JSON.stringify({
      group_id: grpData.group.id,
      name: 'Shimla Ridge Expedition',
      origin: 'Connaught Place, Delhi',
      destination: 'The Mall, Shimla',
      origin_lat: 28.6315,
      origin_lng: 77.2167,
      destination_lat: 31.1048,
      destination_lng: 77.1734,
      distance: '310 km',
      estimated_duration: '6h 45m'
    })
  });
  const trip2Data = await trip2Res.json();
  const trip2Id = trip2Data.trip.id;
  assert(trip2Res.ok && trip2Id, `Trip 2 created (ID: ${trip2Id}, Distance: 310 km)`);

  // User B accesses Trip 2 to join trip_members
  const t2DetailsRes = await fetch(`${API_BASE}/api/trips/${trip2Id}`, { headers: authBHeaders });
  assert(t2DetailsRes.ok, `User B joined trip_members for Trip 2`);

  // Start & Complete Trip 2
  await fetch(`${API_BASE}/api/trips/${trip2Id}/start`, { method: 'POST', headers: authAHeaders });
  const end2Res = await fetch(`${API_BASE}/api/trips/${trip2Id}/end`, { method: 'POST', headers: authAHeaders });
  const end2Data = await end2Res.json();
  assert(end2Res.ok && end2Data.trip?.status === 'COMPLETED', `Trip 2 status is COMPLETED`);

  // 6. Verify /api/trips/history for User A
  console.log('\n--- 6. Verify /api/trips/history for Trip Owner (User A) ---');
  const histRes = await fetch(`${API_BASE}/api/trips/history`, { headers: authAHeaders });
  const histData = await histRes.json();
  assert(histRes.status === 200, `GET /api/trips/history returned HTTP 200`);
  assert(Array.isArray(histData.trips), `Response contains trips array`);

  const returnedTripIds = histData.trips.map(t => t.id);
  assert(returnedTripIds.includes(trip1Id), `History includes Trip 1 (${trip1Id})`);
  assert(returnedTripIds.includes(trip2Id), `History includes Trip 2 (${trip2Id})`);

  // Verify group_name joined and distanceKm parsed
  const returnedTrip2 = histData.trips.find(t => t.id === trip2Id);
  assert(returnedTrip2.group_name === 'Himalayan Wanderers', `Joined group_name is correct ("Himalayan Wanderers")`);
  assert(returnedTrip2.distanceKm === 310, `distanceKm is parsed numeric 310 (Got: ${returnedTrip2.distanceKm})`);

  // 7. Verify /api/trips/stats for User A
  console.log('\n--- 7. Verify /api/trips/stats for Trip Owner (User A) ---');
  const statsRes = await fetch(`${API_BASE}/api/trips/stats`, { headers: authAHeaders });
  const statsData = await statsRes.json();
  assert(statsRes.status === 200, `GET /api/trips/stats returned HTTP 200`);
  assert(statsData.tripsCompleted >= 2, `tripsCompleted is >= 2 (Got: ${statsData.tripsCompleted})`);
  assert(statsData.totalDistanceKm >= 430, `totalDistanceKm is >= 430 km (Got: ${statsData.totalDistanceKm})`);
  assert(statsData.longestTrip && statsData.longestTrip.distanceKm === 310, `longestTrip.distanceKm is 310 (Got: ${statsData.longestTrip?.distanceKm})`);
  assert(statsData.longestTrip.name === 'Shimla Ridge Expedition', `longestTrip.name matches ("Shimla Ridge Expedition")`);

  // Top companion verification
  assert(statsData.topCompanion !== null, `topCompanion is identified`);
  assert(statsData.topCompanion.userId === regBData.user.id, `topCompanion is User B (${regBData.user.name})`);
  assert(statsData.topCompanion.tripsTogether >= 2, `topCompanion tripsTogether is >= 2 (Got: ${statsData.topCompanion?.tripsTogether})`);

  // 8. Verify Clean Empty-State for Brand New User C
  console.log('\n--- 8. Verify Clean Empty State for New User With 0 Trips ---');
  const userCEmail = `newuser_${Date.now()}@grouproute.com`;
  const regCRes = await fetch(`${API_BASE}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Arjun Newbie', email: userCEmail, password })
  });
  const regCData = await regCRes.json();
  const authCHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${regCData.token}`
  };

  const newStatsRes = await fetch(`${API_BASE}/api/trips/stats`, { headers: authCHeaders });
  const newStatsData = await newStatsRes.json();
  assert(newStatsRes.status === 200, `GET /api/trips/stats for new user returned HTTP 200 (not 500)`);
  assert(newStatsData.tripsCompleted === 0, `tripsCompleted is 0`);
  assert(newStatsData.totalDistanceKm === 0, `totalDistanceKm is 0`);
  assert(newStatsData.longestTrip === null, `longestTrip is null`);
  assert(newStatsData.topCompanion === null, `topCompanion is null`);

  const newHistRes = await fetch(`${API_BASE}/api/trips/history`, { headers: authCHeaders });
  const newHistData = await newHistRes.json();
  assert(newHistRes.status === 200, `GET /api/trips/history for new user returned HTTP 200`);
  assert(Array.isArray(newHistData.trips) && newHistData.trips.length === 0, `History trips is empty array []`);

  console.log('\n================================================================');
  console.log(`RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTripHistoryStatsSuite().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
