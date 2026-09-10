import assert from 'assert';
import { mapService } from '../src/services/mapService.js';
import { eventEngine } from '../src/services/eventEngine.js';
import db from '../src/models/db.js';
import redisStore from '../src/services/redisStore.js';
import { selectTravelers } from '../../frontend/src/store/tripStore.js';

console.log('--- STARTING GROUPROUTE CONVOY INTELLIGENCE TEST SUITE ---');

async function runConvoyIntelligenceTests() {
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

  // 1. TEST GEOAPIFY NEARBY POI SEARCH
  console.log('\n[1] Testing Geoapify Nearby POIs Search (Petrol & Hotels)...');
  const murthalPOIs = await mapService.searchNearbyPOIs(29.0264, 77.0700, 2000);
  check('searchNearbyPOIs returns array of places', Array.isArray(murthalPOIs) && murthalPOIs.length > 0);
  const hasPetrol = murthalPOIs.some(p => p.type === 'petrol');
  const hasHotel = murthalPOIs.some(p => p.type === 'hotel');
  check('POIs include petrol station', hasPetrol);
  check('POIs include hotel / lodging', hasHotel);

  // 2. TEST ROUTE CORRIDOR POIS
  console.log('\n[2] Testing Route Corridor POIs...');
  const corridorPOIs = await mapService.searchRouteCorridorPOIs();
  check('Corridor POIs returns highway landmarks', Array.isArray(corridorPOIs) && corridorPOIs.length >= 8);

  // 3. SETUP TEST TRIP IN MEMORY DB
  console.log('\n[3] Setting up Test Trip & Telemetry...');
  const testTripId = 'test-convoy-trip-1';
  const testGroupId = 'test-convoy-group-1';

  db.tables.insert('trips', {
    id: testTripId,
    name: 'Delhi to Manali Convoy Run',
    group_id: testGroupId,
    origin: 'Connaught Place, New Delhi',
    destination: 'Mall Road, Manali',
    origin_lat: 28.6315,
    origin_lng: 77.2167,
    destination_lat: 32.2396,
    destination_lng: 77.1887,
    status: 'ACTIVE'
  });

  const testUser1 = { id: 'u-rahul', name: 'Rahul' };
  const testUser2 = { id: 'u-aman', name: 'Aman' };
  const testUser3 = { id: 'u-karan', name: 'Karan' };

  db.tables.insert('users', testUser1);
  db.tables.insert('users', testUser2);
  db.tables.insert('users', testUser3);

  db.tables.insert('trip_members', { trip_id: testTripId, user_id: testUser1.id });
  db.tables.insert('trip_members', { trip_id: testTripId, user_id: testUser2.id });
  db.tables.insert('trip_members', { trip_id: testTripId, user_id: testUser3.id });

  // Clear Redis state for test trip
  await redisStore.del(`trip:${testTripId}:locations`);

  // 4. TEST LEADER DETECTION BASED ON ROUTE PROGRESS
  console.log('\n[4] Testing Route Progress & Leader Detection...');
  // Rahul at Mandi (further ahead: 31.7087, 76.9320)
  const rahulUpdate = await eventEngine.processLocationUpdate({
    tripId: testTripId,
    userId: testUser1.id,
    latitude: 31.7087,
    longitude: 76.9320,
    speed: 55,
    heading: 350,
    accuracy: 8,
    timestamp: Date.now()
  });

  // Aman at Karnal (further behind: 29.6857, 76.9905)
  const amanUpdate = await eventEngine.processLocationUpdate({
    tripId: testTripId,
    userId: testUser2.id,
    latitude: 29.6857,
    longitude: 76.9905,
    speed: 48,
    heading: 350,
    accuracy: 8,
    timestamp: Date.now()
  });

  const allLocs = await redisStore.hgetall(`trip:${testTripId}:locations`);
  check('Rahul is marked as convoy leader', allLocs['u-rahul']?.isLeader === true);
  check('Aman is not marked as convoy leader', allLocs['u-aman']?.isLeader === false);

  // 5. TEST 10-MINUTE STATIONARY STOP & POI PROXIMITY ALERT
  console.log('\n[5] Testing 10-Minute Stationary Stop Alert (LONG_STOP)...');
  process.env.LONG_STOP_THRESHOLD_MS = '1000'; // Set 1s threshold for test
  process.env.STOP_DETECTION_TIME_MS = '500';

  const t0 = Date.now() - 5000;
  // Step 1: Initial stationary reading (initiates stop candidate)
  await eventEngine.processLocationUpdate({
    tripId: testTripId,
    userId: testUser2.id,
    latitude: 29.0264,
    longitude: 77.0700,
    speed: 0,
    heading: 0,
    accuracy: 5,
    timestamp: t0
  });

  // Step 2: 600ms later -> Confirms STOPPED (> 500ms threshold)
  const stopConfirmUpdate = await eventEngine.processLocationUpdate({
    tripId: testTripId,
    userId: testUser2.id,
    latitude: 29.0264,
    longitude: 77.0700,
    speed: 0,
    heading: 0,
    accuracy: 5,
    timestamp: t0 + 600
  });

  const stopStartedEvent = (stopConfirmUpdate.events || []).find(e => e.event_type === 'STOP_STARTED');
  check('STOP_STARTED event generated on stop confirmation', !!stopStartedEvent);

  // Step 3: 1700ms later -> Reaches LONG_STOP threshold (> 1000ms threshold)
  const stopAlertUpdate = await eventEngine.processLocationUpdate({
    tripId: testTripId,
    userId: testUser2.id,
    latitude: 29.0264,
    longitude: 77.0700,
    speed: 0,
    heading: 0,
    accuracy: 5,
    timestamp: t0 + 1700
  });

  const longStopEvent = (stopAlertUpdate.events || []).find(e => e.event_type === 'LONG_STOP');
  check('LONG_STOP event generated when stationary threshold reached', !!longStopEvent);
  check('LONG_STOP event includes location name', typeof longStopEvent?.metadata?.locationName === 'string');
  check('LONG_STOP event metadata attaches nearby Petrol Station or Hotel',
    !!longStopEvent?.metadata?.nearbyPetrol || !!longStopEvent?.metadata?.nearbyHotel
  );

  // 6. TEST DESTINATION ARRIVAL & ALL_MEMBERS_ARRIVED
  console.log('\n[6] Testing Destination Arrival Detection...');
  process.env.ARRIVAL_RADIUS_KM = '1.0';

  // Move Rahul to destination Mall Road, Manali (32.2396, 77.1887)
  const rahulArrival = await eventEngine.processLocationUpdate({
    tripId: testTripId,
    userId: testUser1.id,
    latitude: 32.2396,
    longitude: 77.1887,
    speed: 0,
    heading: 0,
    accuracy: 5,
    timestamp: Date.now()
  });

  const memberArrivedEvent = (rahulArrival.events || []).find(e => e.event_type === 'MEMBER_ARRIVED');
  check('MEMBER_ARRIVED event generated when reaching destination radius', !!memberArrivedEvent);
  const rahulRedisState = (await redisStore.hgetall(`trip:${testTripId}:locations`))['u-rahul'];
  check('Rahul status in Redis is ARRIVED', rahulRedisState?.status === 'ARRIVED');

  // Move Aman and Karan to destination to trigger ALL_MEMBERS_ARRIVED
  await eventEngine.processLocationUpdate({
    tripId: testTripId,
    userId: testUser2.id,
    latitude: 32.2397,
    longitude: 77.1888,
    speed: 0,
    heading: 0,
    accuracy: 5,
    timestamp: Date.now()
  });

  const karanArrival = await eventEngine.processLocationUpdate({
    tripId: testTripId,
    userId: testUser3.id,
    latitude: 32.2395,
    longitude: 77.1886,
    speed: 0,
    heading: 0,
    accuracy: 5,
    timestamp: Date.now()
  });

  const allEventsInDb = db.tables.get('trip_events').filter(e => e.trip_id === testTripId);
  const allArrivedEvent = allEventsInDb.find(e => e.event_type === 'ALL_MEMBERS_ARRIVED');
  check('ALL_MEMBERS_ARRIVED event recorded in trip events', !!allArrivedEvent);

  // 7. TEST FRONTEND SELECTTRAVELERS CONVOY INTELLIGENCE HIERARCHY
  console.log('\n[7] Testing Frontend selectTravelers Selector & Hierarchy...');
  const members = [
    { id: 'u-rahul', name: 'Rahul', role: 'MEMBER' },
    { id: 'u-aman', name: 'Aman', role: 'MEMBER' },
    { id: 'u-karan', name: 'Karan', role: 'MEMBER' }
  ];

  const liveState = {
    'u-rahul': { userId: 'u-rahul', userName: 'Rahul', latitude: 31.7, longitude: 76.9, speed: 50, status: 'MOVING', routeProgress: 85 },
    'u-aman': { userId: 'u-aman', userName: 'Aman', latitude: 29.0, longitude: 77.0, speed: 0, status: 'STOPPED', isLongStop: true, stoppedSince: new Date(Date.now() - 720000).toISOString() },
    'u-karan': { userId: 'u-karan', userName: 'Karan', latitude: 28.8, longitude: 77.1, speed: 30, status: 'SPLIT', distanceFromGroupKm: 18.5 }
  };

  const compiledTravelers = selectTravelers(members, liveState, 'u-aman', 'Mall Road, Manali');

  check('Compiled travelers is deduplicated (exactly 3 travelers)', compiledTravelers.length === 3);
  check('Rahul is identified as Leader', compiledTravelers.find(t => t.id === 'u-rahul')?.isLeader === true);
  check('Aman has isLongStop: true with stop duration', compiledTravelers.find(t => t.id === 'u-aman')?.isLongStop === true);
  check('Karan is identified with behind status', compiledTravelers.find(t => t.id === 'u-karan')?.convoyRole === 'BEHIND');
  check('Convoy hierarchy sorting puts Leader first', compiledTravelers[0].id === 'u-rahul');

  console.log(`\n======================================================`);
  console.log(`🎉 ALL ${passed}/${total} CONVOY INTELLIGENCE TESTS PASSED!`);
  console.log(`======================================================\n`);
}

runConvoyIntelligenceTests().catch(err => {
  console.error('\n❌ CONVOY INTELLIGENCE TEST SUITE FAILED:', err);
  process.exit(1);
});
