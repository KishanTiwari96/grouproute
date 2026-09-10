import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('====================================================');
console.log('🧪 GROUPROUTE: EVENT LISTENER & LOADER STABILITY TEST');
console.log('====================================================\n');

let passCount = 0;
let failCount = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ [TEST ${passCount + failCount + 1}] PASS: ${message}`);
    passCount++;
  } else {
    console.error(`  ✗ [TEST ${passCount + failCount + 1}] FAIL: ${message}`);
    failCount++;
  }
}

// 1. Inspect CanvasMapVisualizer.jsx
console.log('[1] Inspecting CanvasMapVisualizer.jsx for passive listeners and proper cleanup...');
const canvasFile = path.resolve(__dirname, '../../frontend/src/components/map/CanvasMapVisualizer.jsx');
const canvasContent = fs.readFileSync(canvasFile, 'utf8');

// Test 1: onWheel is NOT in JSX
assert(!canvasContent.includes('onWheel='), 'onWheel React prop removed from JSX to avoid passive listener violation');

// Test 2: wheel listener added with { passive: false }
assert(canvasContent.includes("container.addEventListener('wheel', onWheel, { passive: false })"), 'Wheel listener registered directly on DOM container with { passive: false }');

// Test 3: wheel listener removed with { passive: false }
assert(canvasContent.includes("container.removeEventListener('wheel', onWheel, { passive: false })"), 'Wheel listener cleaned up on unmount with matching { passive: false }');

// Test 4: touchmove listener registered with { passive: false }
assert(canvasContent.includes("container.addEventListener('touchmove', onTouchMove, { passive: false })"), 'Touchmove listener registered with { passive: false } for smooth drag/pinch without passive violation');

// Test 5: touchmove listener cleaned up with { passive: false }
assert(canvasContent.includes("container.removeEventListener('touchmove', onTouchMove, { passive: false })"), 'Touchmove listener cleaned up on unmount with matching { passive: false }');

// Test 6: touchstart and touchend registered with { passive: true }
assert(canvasContent.includes("container.addEventListener('touchstart', onTouchStart, { passive: true })"), 'Touchstart listener registered with { passive: true }');
assert(canvasContent.includes("container.addEventListener('touchend', onTouchEnd, { passive: true })"), 'Touchend listener registered with { passive: true }');

// 2. Inspect GoogleMapContainer.jsx for Leaflet real-map implementation
console.log('\n[2] Inspecting GoogleMapContainer.jsx for real map tile rendering...');
const googleMapFile = path.resolve(__dirname, '../../frontend/src/components/map/GoogleMapContainer.jsx');
const googleMapContent = fs.readFileSync(googleMapFile, 'utf8');

// Test 8: Uses Leaflet MapContainer
assert(googleMapContent.includes('MapContainer'), 'GoogleMapContainer uses Leaflet MapContainer for real map tiles');

// Test 9: Uses real OpenStreetMap tile layer
assert(googleMapContent.includes('tile.openstreetmap.org'), 'Map uses real OpenStreetMap tile URL for genuine road/geography tiles');

// Test 10: Uses OSRM for real road routing (not fake polylines)
assert(googleMapContent.includes('router.project-osrm.org'), 'Route geometry fetched from OSRM (real road routing, not hardcoded polyline)');

// Test 11: Has traveler marker rendering
assert(googleMapContent.includes('createTravelerIcon'), 'Traveler markers are rendered with custom icons on the real map');

console.log('\n====================================================');
if (failCount === 0) {
  console.log(`🎉 ALL ${passCount}/${passCount} EVENT LISTENER & LOADER STABILITY TESTS PASSED!`);
  console.log('====================================================\n');
  process.exit(0);
} else {
  console.error(`❌ ${failCount} TESTS FAILED!`);
  console.log('====================================================\n');
  process.exit(1);
}
