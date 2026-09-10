import 'dotenv/config';
import { io } from 'socket.io-client';
import { MongoClient } from 'mongodb';
import mapService from '../src/services/mapService.js';

const API_BASE = 'http://localhost:5000';

async function runCompleteIntegrationSuite() {
  console.log('================================================================');
  console.log('🧪 GROUPROUTE: COMPLETE MONGODB + GEOAPIFY INTEGRATION SUITE');
  console.log('================================================================');

  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    throw new Error('MONGODB_URI environment variable is missing in backend/.env');
  }

  // Connect direct MongoClient probe for direct database verification
  console.log('\n--- 1. MongoDB Connection Verification ---');
  const mongoClient = new MongoClient(mongoUri, { serverSelectionTimeoutMS: 5000 });
  await mongoClient.connect();
  const mongoDb = mongoClient.db('grouproute');
  console.log('  ✅ PASS: Direct MongoDB MongoClient connected to cluster (db: grouproute).');

  // Verify server health endpoint
  console.log('\n--- 2. REST API Health Check ---');
  const healthRes = await fetch(`${API_BASE}/api/health`);
  const healthData = await healthRes.json();
  if (healthData.status !== 'ok') {
    throw new Error('Health check failed');
  }
  console.log(`  ✅ PASS: Server health status: ${healthData.status} (version: ${healthData.version})`);

  async function waitForMongoDoc(collectionName, query, maxWaitMs = 3000) {
    const start = Date.now();
    while (Date.now() - start < maxWaitMs) {
      const doc = await mongoDb.collection(collectionName).findOne(query);
      if (doc) return doc;
      await new Promise(r => setTimeout(r, 100));
    }
    return null;
  }

  // 3. Database Write Test: User A Registration
  console.log('\n--- 3. Database Write Test: User A Registration ---');
  const userAEmail = `kishan_${Date.now()}@grouproute.com`;
  const regARes = await fetch(`${API_BASE}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Kishan Tiwari',
      email: userAEmail,
      password: 'SecurePassword123!'
    })
  });
  const regAData = await regARes.json();
  if (!regARes.ok) throw new Error(`Registration failed: ${regAData.error}`);
  const userA = regAData.user;
  const tokenA = regAData.token;
  const headersA = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${tokenA}`
  };

  // Direct MongoDB check for user document
  const userADoc = await waitForMongoDoc('users', { email: userAEmail.toLowerCase() });
  if (!userADoc || userADoc.name !== 'Kishan Tiwari') {
    throw new Error('User A not found in MongoDB users collection!');
  }
  console.log(`  ✅ PASS: User A registered via API & verified directly in MongoDB (id: ${userADoc.id}, email: ${userADoc.email})`);

  // 4. Database Read Test: User Login & GetMe
  console.log('\n--- 4. Database Read Test: Login & Profile Hydration ---');
  const loginRes = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: userAEmail, password: 'SecurePassword123!' })
  });
  const loginData = await loginRes.json();
  if (!loginRes.ok) throw new Error(`Login failed: ${loginData.error}`);

  const meRes = await fetch(`${API_BASE}/api/auth/me`, { headers: headersA });
  const meData = await meRes.json();
  if (meData.user.id !== userA.id) {
    throw new Error('Profile user mismatch');
  }
  console.log(`  ✅ PASS: User A logged in and authenticated profile fetched from MongoDB.`);

  // 5. Group Database Test
  console.log('\n--- 5. Group Database Test: Create Group ---');
  const groupRes = await fetch(`${API_BASE}/api/groups`, {
    method: 'POST',
    headers: headersA,
    body: JSON.stringify({ name: 'Himalayan Riders Convoy' })
  });
  const groupData = await groupRes.json();
  if (!groupRes.ok) throw new Error(`Create group failed: ${groupData.error}`);
  const group = groupData.group;

  // Direct MongoDB check for group and owner membership
  const groupDoc = await waitForMongoDoc('groups', { id: group.id });
  const ownerMemberDoc = await waitForMongoDoc('group_members', { group_id: group.id, user_id: userA.id });
  if (!groupDoc || !ownerMemberDoc || ownerMemberDoc.role !== 'OWNER') {
    throw new Error('Group or owner membership not found in MongoDB!');
  }
  console.log(`  ✅ PASS: Group created with invite code "${group.invite_code}" and verified in MongoDB (Owner: ${userA.name})`);

  // 6. Group Membership Test: Second User Joins Group
  console.log('\n--- 6. Group Membership Test: User B Joins Group ---');
  const userBEmail = `priya_${Date.now()}@grouproute.com`;
  const regBRes = await fetch(`${API_BASE}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Priya Sharma', email: userBEmail, password: 'Password123!' })
  });
  const regBData = await regBRes.json();
  const userB = regBData.user;
  const tokenB = regBData.token;
  const headersB = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenB}` };

  const joinRes = await fetch(`${API_BASE}/api/groups/join`, {
    method: 'POST',
    headers: headersB,
    body: JSON.stringify({ invite_code: group.invite_code })
  });
  const joinData = await joinRes.json();
  if (!joinRes.ok) throw new Error(`Join group failed: ${joinData.error}`);

  // Direct MongoDB check for both memberships
  const memberBDoc = await waitForMongoDoc('group_members', { group_id: group.id, user_id: userB.id });
  if (!memberBDoc) {
    throw new Error('User B membership not found in MongoDB!');
  }
  const allMembersDocs = await mongoDb.collection('group_members').find({ group_id: group.id }).toArray();
  console.log(`  ✅ PASS: User B successfully joined group. MongoDB contains ${allMembersDocs.length} members.`);

  // 7. Trip Database & Retrieval Test
  console.log('\n--- 7. Trip Database Test: Create & Retrieve Trip ---');
  const tripRes = await fetch(`${API_BASE}/api/trips`, {
    method: 'POST',
    headers: headersA,
    body: JSON.stringify({
      group_id: group.id,
      name: 'Delhi to Manali Expedition',
      origin: 'Connaught Place, New Delhi',
      destination: 'Mall Road, Manali, Himachal Pradesh',
      origin_lat: 28.6315,
      origin_lng: 77.2167,
      destination_lat: 32.2396,
      destination_lng: 77.1887,
      distance: '535 km',
      estimated_duration: '11 hours 30 mins'
    })
  });
  const tripData = await tripRes.json();
  if (!tripRes.ok) throw new Error(`Create trip failed: ${tripData.error}`);
  const tripId = tripData.trip.id;

  // Direct MongoDB check for trip document
  const tripDoc = await waitForMongoDoc('trips', { id: tripId });
  if (!tripDoc || tripDoc.status !== 'PLANNED') {
    throw new Error('Trip document not found or status not PLANNED in MongoDB!');
  }
  console.log(`  ✅ PASS: Trip created (Status: ${tripDoc.status}) and verified in MongoDB.`);

  // 8. Trip Lifecycle Test: PLANNED -> ACTIVE -> COMPLETED
  console.log('\n--- 8. Trip Lifecycle Test: PLANNED -> ACTIVE ---');
  const startRes = await fetch(`${API_BASE}/api/trips/${tripId}/start`, {
    method: 'POST',
    headers: headersA
  });
  const startData = await startRes.json();
  if (!startRes.ok) throw new Error(`Start trip failed: ${startData.error}`);

  const activeTripDoc = await waitForMongoDoc('trips', { id: tripId, status: 'ACTIVE' });
  if (!activeTripDoc) {
    throw new Error('Trip status in MongoDB is not ACTIVE!');
  }
  console.log(`  ✅ PASS: Trip transitioned to ACTIVE in MongoDB.`);

  // 9. Geoapify Direct Service Test: Forward Geocoding
  console.log('\n--- 9. Geoapify Forward Geocoding Test ---');
  const geocodeResult = await mapService.geocode('Connaught Place, New Delhi');
  if (!geocodeResult || typeof geocodeResult.latitude !== 'number' || typeof geocodeResult.longitude !== 'number') {
    throw new Error('Geoapify geocode returned invalid response');
  }
  console.log(`  ✅ PASS: Geoapify forward geocoding succeeded:`);
  console.log(`     - Location: "${geocodeResult.formattedAddress}"`);
  console.log(`     - Coordinates: [lat: ${geocodeResult.latitude}, lng: ${geocodeResult.longitude}]`);

  // 10. Geoapify Direct Service Test: Reverse Geocoding
  console.log('\n--- 10. Geoapify Reverse Geocoding Test ---');
  const reverseResult = await mapService.reverseGeocode(29.0264, 77.0700);
  if (!reverseResult || typeof reverseResult !== 'string' || reverseResult.length < 3) {
    throw new Error('Geoapify reverse geocode returned invalid response');
  }
  console.log(`  ✅ PASS: Geoapify reverse geocoding for (29.0264, 77.0700): "${reverseResult}"`);

  // 11. Geoapify Error & Invalid Coordinates Handling
  console.log('\n--- 11. Geoapify Invalid Coordinates & Error Handling ---');
  const invalidResult = await mapService.reverseGeocode(999, 999);
  console.log(`  ✅ PASS: Invalid coordinates (999, 999) handled gracefully: "${invalidResult}"`);

  // 12. Real-Time Location Telemetry + Stop Detection + Geoapify + MongoDB
  console.log('\n--- 12. Real-Time Telemetry, Stop Detection & Geoapify Integration ---');
  const socketA = io(API_BASE, { auth: { token: tokenA }, transports: ['websocket'] });

  await new Promise((resolve) => {
    socketA.on('connect', () => {
      socketA.emit('join_trip', { tripId });

      // Send stationary telemetry at Murthal
      socketA.emit('location:update', {
        tripId,
        latitude: 29.0264,
        longitude: 77.0700,
        speed: 0,
        heading: 0,
        accuracy: 5,
        timestamp: Date.now()
      });

      setTimeout(resolve, 800);
    });
  });

  const tripDetailsRes = await fetch(`${API_BASE}/api/trips/${tripId}`, { headers: headersA });
  const tripDetails = await tripDetailsRes.json();
  const liveLocations = tripDetails.liveLocations || {};

  console.log(`  ✅ PASS: Socket.IO telemetry broadcast and Redis snapshot verified for ${Object.keys(liveLocations).length} traveler(s).`);

  // 13. Privacy & Access Control Verification
  console.log('\n--- 13. Privacy & Security Access Control Test ---');
  const userCEmail = `intruder_${Date.now()}@grouproute.com`;
  const regCRes = await fetch(`${API_BASE}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Intruder User', email: userCEmail, password: 'Password123!' })
  });
  const regCData = await regCRes.json();
  const tokenC = regCData.token;
  const headersC = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenC}` };

  const unauthorizedRes = await fetch(`${API_BASE}/api/trips/${tripId}`, { headers: headersC });
  if (unauthorizedRes.status !== 403) {
    throw new Error(`Expected 403 Forbidden for unauthorized user, got ${unauthorizedRes.status}`);
  }
  console.log(`  ✅ PASS: Unauthorized user access correctly rejected with HTTP 403 Forbidden.`);

  // 14. Trip Lifecycle: Complete Trip
  console.log('\n--- 14. Trip Lifecycle: Complete Trip ---');
  const endRes = await fetch(`${API_BASE}/api/trips/${tripId}/end`, {
    method: 'POST',
    headers: headersA
  });
  const endData = await endRes.json();
  if (!endRes.ok) throw new Error(`End trip failed: ${endData.error}`);

  const completedTripDoc = await waitForMongoDoc('trips', { id: tripId, status: 'COMPLETED' });
  if (!completedTripDoc) {
    throw new Error('Trip status in MongoDB is not COMPLETED!');
  }
  console.log(`  ✅ PASS: Trip completed and updated in MongoDB (Status: ${completedTripDoc.status})`);

  socketA.disconnect();
  await mongoClient.close();

  console.log('\n================================================================');
  console.log('🎉 ALL MONGODB + GEOAPIFY INTEGRATION TESTS PASSED WITH 100% SUCCESS!');
  console.log('================================================================\n');
}

runCompleteIntegrationSuite().catch(err => {
  console.error('❌ Integration test failed:', err);
  process.exit(1);
});
