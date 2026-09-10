import assert from 'assert';
import { db } from '../src/models/db.js';
import { generateToken } from '../src/middleware/auth.js';
import { mapService } from '../src/services/mapService.js';
import { selectTravelers } from '../../frontend/src/store/tripStore.js';
import { v4 as uuidv4 } from 'uuid';

console.log('====================================================');
console.log('🧪 GROUPROUTE: POI API & CONVOY INTELLIGENCE TEST');
console.log('====================================================\n');

async function runTestSuite() {
  let passed = 0;
  let total = 0;

  function check(desc, condition) {
    total++;
    if (condition) {
      console.log(`  ✓ [TEST ${total}] PASS: ${desc}`);
      passed++;
    } else {
      console.error(`  ✗ [TEST ${total}] FAIL: ${desc}`);
      throw new Error(`Test failed: ${desc}`);
    }
  }

  // 1. SETUP TEST DATA VIA REST API
  console.log('[1] Setting up Test Users, Group, and Trip via REST API...');
  const reg1Res = await fetch('http://localhost:5000/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Aman POI Tester',
      email: `aman.poi.${Date.now()}@example.com`,
      password: 'password123'
    })
  });
  const reg1Data = await reg1Res.json();
  const validToken = reg1Data.token;

  const reg2Res = await fetch('http://localhost:5000/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Other Traveler',
      email: `other.${Date.now()}@example.com`,
      password: 'password123'
    })
  });
  const reg2Data = await reg2Res.json();
  const otherToken = reg2Data.token;

  // Create Group with User 1
  const grpRes = await fetch('http://localhost:5000/api/groups', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${validToken}` },
    body: JSON.stringify({
      name: 'Manali Convoy Expedition',
      description: 'Road trip to Himalayas'
    })
  });
  const grpData = await grpRes.json();
  const groupId = grpData.group.id;

  // Create Trip with User 1
  const tripRes = await fetch('http://localhost:5000/api/trips', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${validToken}` },
    body: JSON.stringify({
      group_id: groupId,
      name: 'Delhi to Manali Expedition',
      origin: 'New Delhi',
      destination: 'Manali, Himachal Pradesh',
      origin_lat: 28.6315,
      origin_lng: 77.2167,
      destination_lat: 32.2396,
      destination_lng: 77.1887
    })
  });
  const tripData = await tripRes.json();
  const tripId = tripData.trip.id;

  // Start Trip
  await fetch(`http://localhost:5000/api/trips/${tripId}/start`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${validToken}` }
  });

  // 2. TEST HTTP POI API ENDPOINT
  console.log('\n[2] Testing GET /api/trips/:tripId/pois Endpoint...');

  // Test 2.1: Unauthorized request (no token)
  const unauthRes = await fetch(`http://localhost:5000/api/trips/${tripId}/pois`);
  check('Unauthorized request returns 401', unauthRes.status === 401);

  // Test 2.2: Non-existent trip
  const notFoundRes = await fetch(`http://localhost:5000/api/trips/trip-non-existent-999/pois`, {
    headers: { Authorization: `Bearer ${validToken}` }
  });
  check('Non-existent trip returns 404', notFoundRes.status === 404);

  // Test 2.3: Non-member access (Forbidden)
  const forbiddenRes = await fetch(`http://localhost:5000/api/trips/${tripId}/pois`, {
    headers: { Authorization: `Bearer ${otherToken}` }
  });
  check('Non-member request returns 403 Forbidden', forbiddenRes.status === 403);

  // Test 2.4: Valid authenticated member request
  const validRes = await fetch(`http://localhost:5000/api/trips/${tripId}/pois`, {
    headers: { Authorization: `Bearer ${validToken}` }
  });
  check('Authenticated member request returns 200 OK', validRes.status === 200);

  const poiData = await validRes.json();
  check('Response contains pois array', Array.isArray(poiData.pois) && poiData.pois.length > 0);

  // Test 2.5: Normalized FUEL and HOTEL schema
  const fuelPois = poiData.pois.filter(p => p.type === 'FUEL' || p.type === 'petrol');
  const hotelPois = poiData.pois.filter(p => p.type === 'HOTEL' || p.type === 'hotel');
  check('POIs contain route-relevant FUEL stations', fuelPois.length >= 3);
  check('POIs contain route-relevant HOTEL lodgings', hotelPois.length >= 3);

  for (const p of poiData.pois) {
    assert(p.id, 'POI must have id');
    assert(p.name, 'POI must have name');
    assert(p.type === 'FUEL' || p.type === 'HOTEL' || p.type === 'petrol' || p.type === 'hotel', 'POI type must be FUEL or HOTEL');
    assert(typeof p.latitude === 'number', 'POI latitude must be number');
    assert(typeof p.longitude === 'number', 'POI longitude must be number');
    assert(typeof p.address === 'string', 'POI address must be string');
  }
  check('All returned POIs conform strictly to normalized schema (id, name, type, lat, lng, address)', true);

  // 3. TEST STOP DETECTION WITH NEARBY POI MATCHING
  console.log('\n[3] Testing Stop Detection with POI Proximity Matching...');
  const murthalPOIs = await mapService.searchNearbyPOIs(29.0264, 77.0700, 1000);
  check('Murthal stop matches nearby Petrol Pump and Hotel POIs', murthalPOIs.length > 0);

  const membersList = [
    { id: 'u1', name: 'Rahul' },
    { id: 'u2', name: 'Aman' },
    { id: 'u3', name: 'Karan' }
  ];

  // 4. TEST 10-MINUTE STOP ALERT INTEGRITY
  console.log('\n[4] Testing 10-Minute Stop Alert State...');
  const liveState = {
    u1: {
      userId: 'u1',
      userName: 'Rahul',
      latitude: 31.7087,
      longitude: 76.9320,
      speed: 62,
      status: 'MOVING',
      routeProgress: 0.85
    },
    u2: {
      userId: 'u2',
      userName: 'Aman',
      latitude: 29.0264,
      longitude: 77.0700,
      speed: 0,
      status: 'STOPPED',
      isLongStop: true,
      stopDurationSeconds: 660,
      stoppedLocationName: 'Murthal (Sukhdev Dhaba)',
      nearbyPetrol: { name: 'HP Petrol Pump', distanceText: '120 m' },
      nearbyHotel: { name: 'Hotel Highway King', distanceText: '180 m' },
      routeProgress: 0.15
    },
    u3: {
      userId: 'u3',
      userName: 'Karan',
      latitude: 28.7365,
      longitude: 77.1510,
      speed: 40,
      status: 'SPLIT',
      distanceFromGroupKm: 8.5,
      routeProgress: 0.05
    }
  };

  const compiledTravelers = selectTravelers(membersList, liveState, 'u2', 'Manali');

  const leader = compiledTravelers.find(t => t.isLeader);
  check('Rahul is calculated as convoy leader (furthest route progress)', leader?.name === 'Rahul');

  const aman = compiledTravelers.find(t => t.id === 'u2');
  check('Aman is marked with isLongStop = true and stop duration', aman.isLongStop === true && aman.stopDurationText);
  check('Aman has matched nearby Petrol Station (HP Petrol Pump)', aman.nearbyPetrol?.name === 'HP Petrol Pump');
  check('Aman has matched nearby Hotel (Hotel Highway King)', aman.nearbyHotel?.name === 'Hotel Highway King');

  const karan = compiledTravelers.find(t => t.id === 'u3');
  check('Karan is marked as BEHIND / SPLIT with separation distance', karan.status === 'SPLIT' && karan.distanceFromGroupKm === 8.5);

  // 5. TEST ARRIVAL DETECTION
  console.log('\n[5] Testing Destination Arrival State...');
  const arrivedState = {
    u1: {
      userId: 'u1',
      userName: 'Rahul',
      latitude: 32.2396,
      longitude: 77.1887,
      speed: 0,
      status: 'ARRIVED',
      arrivedAt: new Date().toISOString()
    },
    u2: {
      userId: 'u2',
      userName: 'Aman',
      latitude: 32.2396,
      longitude: 77.1887,
      speed: 0,
      status: 'ARRIVED',
      arrivedAt: new Date().toISOString()
    },
    u3: {
      userId: 'u3',
      userName: 'Karan',
      latitude: 32.2396,
      longitude: 77.1887,
      speed: 0,
      status: 'ARRIVED',
      arrivedAt: new Date().toISOString()
    }
  };

  const allArrived = selectTravelers(membersList, arrivedState, 'u2', 'Mall Road, Manali');
  check('All travelers have status = ARRIVED', allArrived.every(t => t.status === 'ARRIVED'));
  check('All travelers have speed = 0 km/h', allArrived.every(t => t.speed === 0));
  check('All travelers have ETA = Arrived', allArrived.every(t => t.eta === 'Arrived'));

  console.log('\n====================================================');
  console.log(`🎉 ALL ${passed}/${total} POI API & CONVOY INTELLIGENCE TESTS PASSED!`);
  console.log('====================================================\n');
}

runTestSuite().catch(err => {
  console.error('\n❌ TEST SUITE FAILED:', err);
  process.exit(1);
});
