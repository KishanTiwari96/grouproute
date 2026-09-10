/**
 * Calculate Great-Circle distance between two coordinates in kilometers using the Haversine formula
 */
export function haversineDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth radius in kilometers
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Calculate Great-Circle distance in meters
 */
export function haversineDistanceMeters(lat1, lon1, lat2, lon2) {
  return haversineDistanceKm(lat1, lon1, lat2, lon2) * 1000;
}

function toRad(degrees) {
  return (degrees * Math.PI) / 180;
}

/**
 * Calculate geographic centroid (average lat/lng) for a collection of points
 */
export function calculateCentroid(points) {
  if (!points || points.length === 0) return null;
  if (points.length === 1) {
    return {
      latitude: points[0].latitude,
      longitude: points[0].longitude
    };
  }

  let x = 0;
  let y = 0;
  let z = 0;

  for (const p of points) {
    const latRad = toRad(p.latitude);
    const lngRad = toRad(p.longitude);
    x += Math.cos(latRad) * Math.cos(lngRad);
    y += Math.cos(latRad) * Math.sin(lngRad);
    z += Math.sin(latRad);
  }

  const total = points.length;
  x = x / total;
  y = y / total;
  z = z / total;

  const centralLng = Math.atan2(y, x);
  const centralSquareRoot = Math.sqrt(x * x + y * y);
  const centralLat = Math.atan2(z, centralSquareRoot);

  return {
    latitude: (centralLat * 180) / Math.PI,
    longitude: (centralLng * 180) / Math.PI
  };
}

/**
 * Calculate compass bearing between two points in degrees
 */
export function calculateBearing(lat1, lon1, lat2, lon2) {
  const y = Math.sin(toRad(lon2 - lon1)) * Math.cos(toRad(lat2));
  const x =
    Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
    Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(toRad(lon2 - lon1));
  const bearing = (Math.atan2(y, x) * 180) / Math.PI;
  return (bearing + 360) % 360;
}

/**
 * Check if coordinate is within radius (in meters)
 */
export function isWithinRadius(lat1, lon1, lat2, lon2, radiusMeters) {
  return haversineDistanceMeters(lat1, lon1, lat2, lon2) <= radiusMeters;
}

/**
 * Approximate distance from a point to a line segment in meters
 */
export function pointLineDistanceMeters(pLat, pLon, aLat, aLon, bLat, bLon) {
  const pLatR = toRad(pLat);
  const pLonR = toRad(pLon);
  const aLatR = toRad(aLat);
  const aLonR = toRad(aLon);
  const bLatR = toRad(bLat);
  const bLonR = toRad(bLon);

  const dx = (bLonR - aLonR) * Math.cos((aLatR + bLatR) / 2);
  const dy = bLatR - aLatR;
  const len2 = dx * dx + dy * dy;

  if (len2 === 0) {
    return haversineDistanceMeters(pLat, pLon, aLat, aLon);
  }

  const px = (pLonR - aLonR) * Math.cos((aLatR + pLatR) / 2);
  const py = pLatR - aLatR;

  let t = (px * dx + py * dy) / len2;
  t = Math.max(0, Math.min(1, t));

  const projLat = aLat + t * (bLat - aLat);
  const projLon = aLon + t * (bLon - aLon);

  return haversineDistanceMeters(pLat, pLon, projLat, projLon);
}

/**
 * Minimum distance from a point to a full polyline (array of [lat, lng])
 */
export function distanceToPolylineMeters(lat, lng, polylineArray) {
  if (!polylineArray || polylineArray.length < 2) return Infinity;
  let minDist = Infinity;
  for (let i = 0; i < polylineArray.length - 1; i++) {
    const p1 = polylineArray[i];
    const p2 = polylineArray[i+1];
    const d = pointLineDistanceMeters(lat, lng, p1[0], p1[1], p2[0], p2[1]);
    if (d < minDist) minDist = d;
  }
  return minDist;
}
