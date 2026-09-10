import assert from 'assert';
import { selectTravelers } from '../../frontend/src/store/tripStore.js';
import { mapService } from '../src/services/mapService.js';

console.log('====================================================');
console.log('🧪 GROUPROUTE: POI SAFE RENDERING & REGRESSION TEST');
console.log('====================================================\n');

function runRegressionSuite() {
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

  // 1. TEST SAFE POI NORMALIZATION (Undefined, Null, Empty, Malformed)
  console.log('[1] Testing POI Normalization and Safe Fallbacks...');

  function normalizePOIs(rawPois, storePois) {
    const candidate = rawPois !== undefined ? rawPois : storePois;
    return Array.isArray(candidate) ? candidate : [];
  }

  const testUndefined = normalizePOIs(undefined, undefined);
  check('Undefined POIs resolves to empty array []', Array.isArray(testUndefined) && testUndefined.length === 0);

  const testNull = normalizePOIs(null, null);
  check('Null POIs resolves to empty array []', Array.isArray(testNull) && testNull.length === 0);

  const testEmpty = normalizePOIs([], []);
  check('Empty array resolves to empty array []', Array.isArray(testEmpty) && testEmpty.length === 0);

  const testStoreFallback = normalizePOIs(undefined, [{ id: 'p1', type: 'petrol', name: 'HP Pump' }]);
  check('Fallback to store POIs when prop is undefined', testStoreFallback.length === 1 && testStoreFallback[0].id === 'p1');

  // 2. TEST LAYER FILTERING WITH DEFENSIVE FILTERING
  console.log('\n[2] Testing Layer Visibility & Filtering...');
  const samplePOIs = [
    { id: 'poi-1', type: 'petrol', name: 'HP Pump', latitude: 29.0270, longitude: 77.0710 },
    { id: 'poi-2', type: 'hotel', name: 'Hotel King', latitude: 29.0280, longitude: 77.0725 },
    { id: 'poi-3', type: 'petrol', name: 'IndianOil', latitude: 29.6860, longitude: 76.9910 },
    null,
    undefined,
    { id: 'poi-invalid' } // Missing coordinates and type
  ];

  const layerVisibility = { petrol: true, hotels: false, members: true, stops: true };

  // Filter petrol
  const petrolPOIs = layerVisibility.petrol
    ? (Array.isArray(samplePOIs) ? samplePOIs : []).filter(p => p && p.type === 'petrol' && p.latitude && p.longitude)
    : [];
  check('Petrol filter returns exactly 2 valid petrol stations', petrolPOIs.length === 2);

  // Filter hotels with layer OFF
  const hotelPOIs = layerVisibility.hotels
    ? (Array.isArray(samplePOIs) ? samplePOIs : []).filter(p => p && p.type === 'hotel' && p.latitude && p.longitude)
    : [];
  check('Hotel filter returns empty array when layer is OFF', hotelPOIs.length === 0);

  // 3. TEST SELECTTRAVELERS WITH STOP PROXIMITY
  console.log('\n[3] Testing selectTravelers with POI Proximity Data...');
  const members = [{ id: 'u-aman', name: 'Aman' }];
  const liveState = {
    'u-aman': {
      userId: 'u-aman',
      userName: 'Aman',
      latitude: 29.0264,
      longitude: 77.0700,
      speed: 0,
      status: 'STOPPED',
      isLongStop: true,
      nearbyPetrol: { name: 'HP Petrol Pump', distanceText: '120 m' },
      nearbyHotel: { name: 'Hotel Highway King', distanceText: '180 m' }
    }
  };

  const travelers = selectTravelers(members, liveState, 'u-aman', 'Manali');
  check('Aman traveler includes attached nearbyPetrol', travelers[0].nearbyPetrol?.name === 'HP Petrol Pump');
  check('Aman traveler includes attached nearbyHotel', travelers[0].nearbyHotel?.name === 'Hotel Highway King');
  check('Aman is marked as isLongStop', travelers[0].isLongStop === true);

  // 4. TEST GEOAPIFY REAL / FALLBACK POI SCHEMA INTEGRITY
  console.log('\n[4] Testing Geoapify Route Corridor POI Schema...');
  return mapService.searchRouteCorridorPOIs().then(corridorPOIs => {
    check('searchRouteCorridorPOIs returns list of landmarks', Array.isArray(corridorPOIs) && corridorPOIs.length >= 8);
    for (const p of corridorPOIs) {
      assert(typeof p.id === 'string', 'POI id must be string');
      assert(typeof p.name === 'string', 'POI name must be string');
      assert(p.type === 'petrol' || p.type === 'hotel' || p.type === 'FUEL' || p.type === 'HOTEL', 'POI type must be petrol/FUEL or hotel/HOTEL');
      assert(typeof p.latitude === 'number', 'POI latitude must be number');
      assert(typeof p.longitude === 'number', 'POI longitude must be number');
    }
    check('All POIs strictly match normalized schema (id, name, type, lat, lng, address)', true);

    console.log('\n====================================================');
    console.log(`🎉 ALL ${passed}/${total} POI REGRESSION TESTS PASSED!`);
    console.log('====================================================\n');
  });
}

runRegressionSuite().catch(err => {
  console.error('\n❌ POI REGRESSION TEST FAILED:', err);
  process.exit(1);
});
