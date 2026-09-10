import 'dotenv/config';
import { selectTravelers } from '../../frontend/src/store/tripStore.js';

console.log('====================================================');
console.log('🧪 GROUPROUTE: CANONICAL TRAVELER & UI SIMPLICITY TEST');
console.log('====================================================');

async function runTestSuite() {
  // Test 1: Canonical Deduplication with Triplicate Sources (Database + Telemetry + Simulation)
  console.log('\n--- 1. Testing Canonical Deduplication (DB + Live GPS + Simulation) ---');
  const loggedInUserId = 'usr-aman-101';

  const dbMembers = [
    { id: 'usr-aman-101', name: 'Aman', email: 'aman@grouproute.com', role: 'OWNER' },
    { id: 'usr-rahul-102', name: 'Rahul', email: 'rahul@grouproute.com', role: 'MEMBER' },
    { id: 'usr-neha-103', name: 'Neha', email: 'neha@grouproute.com', role: 'MEMBER' },
    { id: 'usr-karan-104', name: 'Karan', email: 'karan@grouproute.com', role: 'MEMBER' },
    { id: 'usr-priya-105', name: 'Priya', email: 'priya@grouproute.com', role: 'MEMBER' }
  ];

  const liveLocations = {
    // Real GPS telemetry
    'usr-aman-101': {
      userId: 'usr-aman-101',
      userName: 'Aman',
      latitude: 29.0264,
      longitude: 77.0700,
      speed: 55,
      status: 'MOVING',
      locationName: 'Murthal (Sukhdev Dhaba)'
    },
    // Simulation telemetry reporting for Aman under simulated alias
    'sim-aman': {
      userId: 'sim-aman',
      userName: 'Aman',
      latitude: 29.0300,
      longitude: 77.0720,
      speed: 60,
      status: 'MOVING',
      locationName: 'Murthal Corridor'
    },
    // Other travelers
    'usr-rahul-102': {
      userId: 'usr-rahul-102',
      userName: 'Rahul',
      latitude: 29.3909,
      longitude: 76.9635,
      speed: 62,
      status: 'MOVING',
      locationName: 'Panipat Toll Plaza'
    },
    'usr-neha-103': {
      userId: 'usr-neha-103',
      userName: 'Neha',
      latitude: 29.6857,
      longitude: 76.9905,
      speed: 58,
      status: 'MOVING',
      locationName: 'Karnal Bypass'
    },
    'usr-karan-104': {
      userId: 'usr-karan-104',
      userName: 'Karan',
      latitude: 28.9500,
      longitude: 77.1200,
      speed: 35,
      status: 'MOVING',
      locationName: 'Sonipat Highway'
    },
    'usr-priya-105': {
      userId: 'usr-priya-105',
      userName: 'Priya',
      latitude: 29.0264,
      longitude: 77.0700,
      speed: 0,
      status: 'STOPPED',
      stoppedLocationName: 'Murthal (Sukhdev Dhaba)',
      stopDurationSeconds: 720
    }
  };

  const compiledTravelers = selectTravelers(dbMembers, liveLocations, loggedInUserId);
  console.log(`  📊 Total compiled travelers: ${compiledTravelers.length}`);

  if (compiledTravelers.length !== 5) {
    throw new Error(`Expected exactly 5 canonical travelers, but received ${compiledTravelers.length}!`);
  }

  const amanEntries = compiledTravelers.filter(t => t.name.toLowerCase() === 'aman' || t.id === loggedInUserId);
  if (amanEntries.length !== 1) {
    throw new Error(`Expected exactly 1 Aman entry, but found ${amanEntries.length}!`);
  }
  console.log(`  ✅ PASS: Exactly 1 canonical Aman found (ID: ${amanEntries[0].id}, isMe: ${amanEntries[0].isMe}, Speed: ${amanEntries[0].speed} km/h).`);

  // Test 2: In-place Telemetry Update
  console.log('\n--- 2. Testing In-Place Location & Speed Update for Aman ---');
  liveLocations['usr-aman-101'] = {
    userId: 'usr-aman-101',
    userName: 'Aman',
    latitude: 29.1500,
    longitude: 77.0500,
    speed: 75,
    status: 'MOVING',
    locationName: 'Gannaur Corridor'
  };

  const updatedTravelers = selectTravelers(dbMembers, liveLocations, loggedInUserId);
  const updatedAman = updatedTravelers.find(t => t.id === loggedInUserId);

  if (updatedTravelers.length !== 5) {
    throw new Error(`Traveler count changed after update! Expected 5, got ${updatedTravelers.length}`);
  }
  if (updatedAman.speed !== 75 || updatedAman.locationName !== 'Gannaur Corridor') {
    throw new Error('Aman in-place update failed!');
  }
  console.log(`  ✅ PASS: Aman updated in-place (Speed: ${updatedAman.speed} km/h, Location: ${updatedAman.locationName}). Total count remains 5.`);

  // Test 3: Stop Detection & Duration Handling
  console.log('\n--- 3. Testing Stop State Transition on Aman ---');
  liveLocations['usr-aman-101'] = {
    userId: 'usr-aman-101',
    userName: 'Aman',
    latitude: 29.3909,
    longitude: 76.9635,
    speed: 0,
    status: 'STOPPED',
    stoppedLocationName: 'Panipat Food Court',
    stopDurationSeconds: 900
  };

  const stoppedTravelers = selectTravelers(dbMembers, liveLocations, loggedInUserId);
  const stoppedAman = stoppedTravelers.find(t => t.id === loggedInUserId);

  if (stoppedTravelers.length !== 5) {
    throw new Error(`Traveler count changed on stop event! Expected 5, got ${stoppedTravelers.length}`);
  }
  if (stoppedAman.status !== 'STOPPED' || stoppedAman.stopDurationText !== '15 min') {
    throw new Error(`Stop transition failed! Status: ${stoppedAman.status}, Duration: ${stoppedAman.stopDurationText}`);
  }
  console.log(`  ✅ PASS: Stop transition verified. Aman status: STOPPED (Duration: ${stoppedAman.stopDurationText}, Location: ${stoppedAman.stoppedLocationName}). Total count remains 5.`);

  // Test 4: Split & Separation Alert Handling
  console.log('\n--- 4. Testing Split / Fall Behind Transition on Karan ---');
  liveLocations['usr-karan-104'] = {
    userId: 'usr-karan-104',
    userName: 'Karan',
    latitude: 28.8000,
    longitude: 77.1000,
    speed: 30,
    status: 'SPLIT',
    distanceFromGroupKm: 12.8,
    locationName: 'Kundli Border'
  };

  const splitTravelers = selectTravelers(dbMembers, liveLocations, loggedInUserId);
  const splitKaran = splitTravelers.find(t => t.id === 'usr-karan-104');

  if (splitTravelers.length !== 5) {
    throw new Error(`Traveler count changed on split event! Expected 5, got ${splitTravelers.length}`);
  }
  if (splitKaran.status !== 'SPLIT' || splitKaran.distanceFromGroupKm !== 12.8) {
    throw new Error(`Split transition failed! Status: ${splitKaran.status}, Dist: ${splitKaran.distanceFromGroupKm}`);
  }
  console.log(`  ✅ PASS: Split transition verified. Karan status: SPLIT (${splitKaran.distanceFromGroupKm} km behind convoy). Total count remains 5.`);

  // Test 5: Rejoin Transition
  console.log('\n--- 5. Testing Rejoin Transition on Karan ---');
  liveLocations['usr-karan-104'] = {
    userId: 'usr-karan-104',
    userName: 'Karan',
    latitude: 29.3500,
    longitude: 76.9700,
    speed: 65,
    status: 'MOVING',
    distanceFromGroupKm: 0.8,
    locationName: 'Panipat Approach'
  };

  const rejoinedTravelers = selectTravelers(dbMembers, liveLocations, loggedInUserId);
  const rejoinedKaran = rejoinedTravelers.find(t => t.id === 'usr-karan-104');

  if (rejoinedTravelers.length !== 5) {
    throw new Error(`Traveler count changed on rejoin event! Expected 5, got ${rejoinedTravelers.length}`);
  }
  if (rejoinedKaran.status !== 'MOVING' || rejoinedKaran.speed !== 65) {
    throw new Error(`Rejoin transition failed! Status: ${rejoinedKaran.status}, Speed: ${rejoinedKaran.speed}`);
  }
  console.log(`  ✅ PASS: Rejoin transition verified. Karan is MOVING at ${rejoinedKaran.speed} km/h. Total count remains 5.`);

  console.log('\n====================================================');
  console.log('🎉 ALL CANONICAL IDENTITY & CLEAN UI TESTS PASSED!');
  console.log('====================================================\n');
}

runTestSuite().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
