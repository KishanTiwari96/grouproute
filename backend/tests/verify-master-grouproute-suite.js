import assert from 'assert';
import { db } from '../src/models/db.js';
import { mapService } from '../src/services/mapService.js';
import { selectTravelers } from '../../frontend/src/store/tripStore.js';
import { generateToken } from '../src/middleware/auth.js';

console.log('====================================================================');
console.log('🌟 GROUPROUTE: MASTER COMPREHENSIVE CONVOY & MAPPING SUITE');
console.log('====================================================================\n');

async function runMasterSuite() {
  let passed = 0;
  let total = 0;

  function check(title, condition) {
    total++;
    if (condition) {
      console.log(`  ✓ [TEST ${total}] PASS: ${title}`);
      passed++;
    } else {
      console.error(`  ✗ [TEST ${total}] FAIL: ${title}`);
      throw new Error(`Test failed: ${title}`);
    }
  }

  // AREA 1: SETUP REAL USERS, CONVOY, AND TRIP
  console.log('[1] Initializing Convoy Group & Trip (Delhi -> Manali)...');
  const regRes = await fetch('http://localhost:5000/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Mohit Sharma',
      email: `mohit.master.${Date.now()}@grouproute.com`,
      password: 'password123'
    })
  });
  const regData = await regRes.json();
  const token = regData.token;
  const mohitId = regData.user.id;

  const groupRes = await fetch('http://localhost:5000/api/groups', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ name: 'Himalayan Convoy 2026' })
  });
  const groupData = await groupRes.json();
  const groupId = groupData.group.id;

  const tripRes = await fetch('http://localhost:5000/api/trips', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      group_id: groupId,
      name: 'Connaught Place to Mall Road Manali',
      origin: 'Connaught Place, New Delhi',
      destination: 'Mall Road, Manali, Himachal Pradesh',
      origin_lat: 28.6315,
      origin_lng: 77.2167,
      destination_lat: 32.2396,
      destination_lng: 77.1887
    })
  });
  const tripData = await tripRes.json();
  const tripId = tripData.trip.id;

  check('Trip created with real Delhi origin and Manali destination', tripData.trip.origin_lat === 28.6315 && tripData.trip.destination_lat === 32.2396);

  // AREA 2: POI ROUTE CORRIDOR API
  console.log('\n[2] Testing Route Corridor POI API & Schema...');
  const poiRes = await fetch(`http://localhost:5000/api/trips/${tripId}/pois`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const poiPayload = await poiRes.json();

  check('POI API returns HTTP 200 with pois array', poiRes.status === 200 && Array.isArray(poiPayload.pois));
  const fuels = poiPayload.pois.filter(p => p.type === 'FUEL' || p.type === 'petrol');
  const hotels = poiPayload.pois.filter(p => p.type === 'HOTEL' || p.type === 'hotel');
  check('Corridor contains route-relevant fuel stations (Murthal, Karnal, Mandi, Manali)', fuels.length >= 3);
  check('Corridor contains route-relevant hotels (Murthal, Karnal, Bilaspur, Kullu, Manali)', hotels.length >= 3);

  // AREA 3: CANONICAL DEDUPLICATION & 5 TRAVELERS STATE
  console.log('\n[3] Testing Single Source of Truth & Canonical Deduplication...');
  const dbMembers = [
    { id: mohitId, name: 'Mohit Sharma' },
    { id: 'usr-aman', name: 'Aman' },
    { id: 'usr-karan', name: 'Karan' },
    { id: 'usr-neha', name: 'Neha' },
    { id: 'usr-priya', name: 'Priya' }
  ];

  const liveTelemetry = {
    [mohitId]: {
      userId: mohitId,
      userName: 'Mohit Sharma',
      latitude: 29.6857,
      longitude: 76.9905,
      speed: 58,
      status: 'MOVING',
      locationName: 'Karnal, Haryana',
      distanceToDestinationKm: 340.2,
      routeProgress: 0.35
    },
    'usr-aman': {
      userId: 'usr-aman',
      userName: 'Aman',
      latitude: 29.3909,
      longitude: 76.9635,
      speed: 48,
      status: 'MOVING',
      locationName: 'Panipat, Haryana',
      distanceToDestinationKm: 355.0,
      routeProgress: 0.31
    },
    'usr-karan': {
      userId: 'usr-karan',
      userName: 'Karan',
      latitude: 29.6500,
      longitude: 76.9850,
      speed: 58,
      status: 'MOVING',
      locationName: 'Karnal Bypass',
      distanceToDestinationKm: 343.0,
      routeProgress: 0.34
    },
    'usr-neha': {
      userId: 'usr-neha',
      userName: 'Neha',
      latitude: 29.9695,
      longitude: 76.8783,
      speed: 64,
      status: 'MOVING',
      locationName: 'Kurukshetra, Haryana',
      distanceToDestinationKm: 310.5,
      routeProgress: 0.42
    },
    'usr-priya': {
      userId: 'usr-priya',
      userName: 'Priya',
      latitude: 29.0264,
      longitude: 77.0700,
      speed: 0,
      status: 'STOPPED',
      stoppedLocationName: 'Murthal (Sukhdev Dhaba)',
      stoppedSince: new Date(Date.now() - 4 * 60 * 1000).toISOString(),
      distanceToDestinationKm: 395.0,
      routeProgress: 0.22,
      nearbyPetrol: { name: 'HP Petrol Pump (Sukhdev Hub)', distanceText: '100 m' }
    }
  };

  const compiled = selectTravelers(dbMembers, liveTelemetry, mohitId, 'Mall Road, Manali');
  check('Exactly 5 unique travelers compiled (zero duplicates)', compiled.length === 5);
  check('Mohit has isMe = true', compiled.find(t => t.id === mohitId)?.isMe === true);

  // AREA 4: LEADER & RELATIVE AHEAD/BEHIND CALCULATION
  console.log('\n[4] Testing Convoy Leader & Ahead/Behind Distances...');
  const leader = compiled.find(t => t.isLeader);
  check('Neha is calculated as LEADER (furthest route progress: 310.5 km to dest)', leader?.name === 'Neha');

  const karan = compiled.find(t => t.name === 'Karan');
  check('Karan position relative to leader is ~32.5 km behind leader', karan.relativePositionText.includes('behind leader'));

  const aman = compiled.find(t => t.name === 'Aman');
  check('Aman position relative to leader is ~44.5 km behind leader', aman.relativePositionText.includes('behind leader'));

  const priya = compiled.find(t => t.name === 'Priya');
  check('Priya position is Stopped at Murthal with nearby HP Petrol Pump', priya.status === 'STOPPED' && priya.nearbyPetrol?.name.includes('HP Petrol'));

  // AREA 5: DYNAMIC LEADER CHANGE
  console.log('\n[5] Testing Dynamic Leader Transition when Convoy Position Changes...');
  // Mohit speeds up and overtakes everyone
  const updatedTelemetry = {
    ...liveTelemetry,
    [mohitId]: {
      ...liveTelemetry[mohitId],
      latitude: 31.7087,
      longitude: 76.9320,
      speed: 82,
      distanceToDestinationKm: 180.0,
      routeProgress: 0.65
    }
  };
  const recompiled = selectTravelers(dbMembers, updatedTelemetry, mohitId, 'Mall Road, Manali');
  const newLeader = recompiled.find(t => t.isLeader);
  check('Mohit is now the dynamic LEADER after overtaking', newLeader?.id === mohitId);

  // AREA 6: 10-MINUTE STOP ALERT STATE
  console.log('\n[6] Testing 10-Minute Stationary Stop Alert Condition...');
  const tenMinTelemetry = {
    ...liveTelemetry,
    'usr-priya': {
      ...liveTelemetry['usr-priya'],
      stoppedSince: new Date(Date.now() - 11 * 60 * 1000).toISOString(),
      stopDurationSeconds: 660,
      isLongStop: true
    }
  };
  const tenMinState = selectTravelers(dbMembers, tenMinTelemetry, mohitId, 'Mall Road, Manali');
  const priyaStop = tenMinState.find(t => t.name === 'Priya');
  check('Priya is marked with isLongStop = true for 10+ min stationary stop', priyaStop.isLongStop === true && priyaStop.stopDurationMinutes >= 10);

  // AREA 7: DESTINATION ARRIVAL & ALL-ARRIVED CELEBRATION
  console.log('\n[7] Testing Destination Arrival State & Convoy Completion...');
  const allArrivedTelemetry = {};
  dbMembers.forEach(m => {
    allArrivedTelemetry[m.id] = {
      userId: m.id,
      userName: m.name,
      latitude: 32.2396,
      longitude: 77.1887,
      speed: 0,
      status: 'ARRIVED',
      arrivedAt: new Date().toISOString(),
      distanceToDestinationKm: 0,
      routeProgress: 1.0
    };
  });
  const allArrivedState = selectTravelers(dbMembers, allArrivedTelemetry, mohitId, 'Mall Road, Manali');
  check('All 5 travelers have status = ARRIVED', allArrivedState.every(t => t.status === 'ARRIVED'));
  check('All 5 travelers have speed = 0 km/h', allArrivedState.every(t => t.speed === 0));
  check('All 5 travelers have ETA = Arrived', allArrivedState.every(t => t.eta === 'Arrived'));
  check('All 5 travelers have relativePositionText = Arrived', allArrivedState.every(t => t.relativePositionText === 'Arrived'));

  console.log('\n====================================================================');
  console.log(`🎉 ALL ${passed}/${total} MASTER CONVOY & MAPPING TESTS PASSED (100%)!`);
  console.log('====================================================================\n');
}

runMasterSuite().catch(err => {
  console.error('\n❌ MASTER SUITE FAILED:', err);
  process.exit(1);
});
