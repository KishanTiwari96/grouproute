import 'dotenv/config';
import { haversineDistanceKm, haversineDistanceMeters, calculateCentroid } from '../src/utils/geo.js';
import eventEngine from '../src/services/eventEngine.js';
import mapService from '../src/services/mapService.js';
import db, { initDb } from '../src/models/db.js';
import redisStore from '../src/services/redisStore.js';
import { generateToken } from '../src/middleware/auth.js';

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

async function runTests() {
  console.log('\n========================================');
  console.log('🧪 RUNNING GROUPROUTE INTELLIGENCE SUITE');
  console.log('========================================\n');

  await initDb();

  // Test 1: Geodesic Haversine Math
  console.log('--- Test Suite 1: Geographic Utilities ---');
  const dDelhiToMurthal = haversineDistanceKm(28.6315, 77.2167, 29.0264, 77.0700);
  assert(dDelhiToMurthal > 40 && dDelhiToMurthal < 50, `Haversine Delhi -> Murthal is ~45.5km (calculated: ${dDelhiToMurthal.toFixed(2)} km)`);

  const dMeters = haversineDistanceMeters(28.6315, 77.2167, 28.6316, 77.2168);
  assert(dMeters > 5 && dMeters < 25, `Small displacement is ~15m (calculated: ${dMeters.toFixed(2)}m)`);

  const points = [
    { latitude: 28.6, longitude: 77.2 },
    { latitude: 28.8, longitude: 77.4 }
  ];
  const centroid = calculateCentroid(points);
  assert(Math.abs(centroid.latitude - 28.7) < 0.05, `Centroid latitude is ~28.7 (calculated: ${centroid.latitude.toFixed(4)})`);
  assert(Math.abs(centroid.longitude - 77.3) < 0.05, `Centroid longitude is ~77.3 (calculated: ${centroid.longitude.toFixed(4)})`);

  // Test 2: ETA Calculation Engine
  console.log('\n--- Test Suite 2: ETA Calculation Engine ---');
  const indEta = mapService.calculateIndividualEta(28.6315, 77.2167, 32.2396, 77.1887, 50);
  assert(indEta.totalMinutes > 300, `Delhi to Manali ETA is realistic (${indEta.formattedEta}, ${indEta.distanceKm} km)`);

  const groupEta = mapService.calculateGroupEta([
    { latitude: 28.63, longitude: 77.21, speed: 60 },
    { latitude: 28.50, longitude: 77.10, speed: 45 }
  ], 32.2396, 77.1887);
  assert(groupEta.totalMinutes > 0, `Group ETA calculated successfully: ${groupEta.formattedEta}`);

  // Test 3: Stop Detection State Machine & Event Engine
  console.log('\n--- Test Suite 3: Location Intelligence & Stop Detection Engine ---');
  process.env.STOP_DETECTION_TIME_MS = '500'; // fast for testing
  process.env.DEMO_MODE = 'true';
  process.env.SPLIT_DISTANCE_KM = '5.0';
  process.env.REJOIN_DISTANCE_KM = '2.0';
  process.env.SPLIT_DETECTION_TIME_MS = '0';
  process.env.REJOIN_DETECTION_TIME_MS = '0';

  // Create test user and trip
  const testUser = db.tables.insert('users', {
    name: 'Aman Sharma',
    email: 'aman@test.com',
    password_hash: 'hash',
    profile_image: ''
  });

  const testTrip = db.tables.insert('trips', {
    name: 'Delhi to Manali Test',
    origin: 'Delhi',
    destination: 'Manali',
    origin_lat: 28.6315,
    origin_lng: 77.2167,
    destination_lat: 32.2396,
    destination_lng: 77.1887,
    status: 'ACTIVE'
  });

  // Step A: Aman is moving at 60 km/h
  const update1 = await eventEngine.processLocationUpdate({
    tripId: testTrip.id,
    userId: testUser.id,
    latitude: 29.0264,
    longitude: 77.0700,
    speed: 60,
    timestamp: 1000
  });
  assert(update1.updatedLocation.status === 'MOVING', 'Initial status is MOVING');

  // Step B: Aman slows down at Murthal (speed = 0 km/h)
  const update2 = await eventEngine.processLocationUpdate({
    tripId: testTrip.id,
    userId: testUser.id,
    latitude: 29.0264,
    longitude: 77.0700,
    speed: 0,
    timestamp: 2000
  });
  assert(update2.updatedLocation.status === 'POSSIBLE_STOP', 'Immediate low-speed update transitions to POSSIBLE_STOP');

  // Step C: Aman remains stationary past threshold (1000ms > 500ms threshold)
  const update3 = await eventEngine.processLocationUpdate({
    tripId: testTrip.id,
    userId: testUser.id,
    latitude: 29.0264,
    longitude: 77.0700,
    speed: 0,
    timestamp: 3000
  });
  assert(update3.updatedLocation.status === 'STOPPED', 'Persisted stationary condition transitions to STOPPED');
  const stopStartedEvt = update3.events.find(e => e.event_type === 'STOP_STARTED');
  assert(!!stopStartedEvt, 'STOP_STARTED event emitted');
  assert(stopStartedEvt?.location_name?.includes('Murthal'), `Reverse geocoded location name detected correctly: ${stopStartedEvt?.location_name}`);

  // Step D: Aman resumes driving (speed = 55 km/h, displacement > 100m)
  const update4 = await eventEngine.processLocationUpdate({
    tripId: testTrip.id,
    userId: testUser.id,
    latitude: 29.0350,
    longitude: 77.0720,
    speed: 55,
    timestamp: 6000
  });
  assert(update4.updatedLocation.status === 'MOVING', 'Resumed speed transitions back to MOVING');
  const stopEndedEvt = update4.events.find(e => e.event_type === 'STOP_ENDED');
  assert(!!stopEndedEvt, 'STOP_ENDED event emitted with duration');
  assert(stopEndedEvt?.metadata?.durationSeconds > 0, `Stop duration calculated: ${stopEndedEvt?.metadata?.durationSeconds}s`);

  // Test 4: Group Split and Rejoin Engine
  console.log('\n--- Test Suite 4: Group Split & Rejoin Engine ---');
  // Add Rahul at group center
  const rahulUser = db.tables.insert('users', { name: 'Rahul', email: 'rahul@test.com', password_hash: 'hash' });
  await eventEngine.processLocationUpdate({
    tripId: testTrip.id,
    userId: rahulUser.id,
    latitude: 29.0350,
    longitude: 77.0720,
    speed: 55,
    timestamp: 6000
  });

  // Karan falls 8 km behind (28.96, 77.05)
  const karanUser = db.tables.insert('users', { name: 'Karan', email: 'karan@test.com', password_hash: 'hash' });
  const karanSplitUpdate = await eventEngine.processLocationUpdate({
    tripId: testTrip.id,
    userId: karanUser.id,
    latitude: 28.9600,
    longitude: 77.0500,
    speed: 20,
    timestamp: 6000
  });
  assert(karanSplitUpdate.updatedLocation.distanceFromGroupKm > 5.0, `Karan distance from group is ${karanSplitUpdate.updatedLocation.distanceFromGroupKm} km (> 5km threshold)`);
  assert(karanSplitUpdate.updatedLocation.status === 'SPLIT', 'Karan status transitions to SPLIT');
  const splitEvt = karanSplitUpdate.events.find(e => e.event_type === 'MEMBER_FELL_BEHIND');
  assert(!!splitEvt, 'MEMBER_FELL_BEHIND event triggered for Karan');

  // Karan catches up and rejoins (moves within 1km of group)
  const karanRejoinUpdate = await eventEngine.processLocationUpdate({
    tripId: testTrip.id,
    userId: karanUser.id,
    latitude: 29.0340,
    longitude: 77.0710,
    speed: 55,
    timestamp: 30000
  });
  assert(karanRejoinUpdate.updatedLocation.distanceFromGroupKm <= 2.0, `Karan distance is now ${karanRejoinUpdate.updatedLocation.distanceFromGroupKm} km (<= 2km rejoin threshold)`);
  const rejoinEvt = karanRejoinUpdate.events.find(e => e.event_type === 'MEMBER_REJOINED');
  assert(!!rejoinEvt, 'MEMBER_REJOINED event triggered successfully');

  // Test 5: Authentication & JWT Token Verification
  console.log('\n--- Test Suite 5: JWT Authentication ---');
  const token = generateToken(testUser);
  assert(typeof token === 'string' && token.length > 20, 'JWT token generated successfully');

  console.log('\n========================================');
  console.log(`RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('========================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Test execution error:', err);
  process.exit(1);
});
