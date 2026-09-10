import { haversineDistanceKm } from '../utils/geo.js';

const geocodeCache = new Map();
const poiCache = new Map();
const isDemoModeEnabled = () => process.env.DEMO_MODE === 'true';

// Known waypoint database for instant and realistic offline reverse geocoding
const knownWaypoints = [
  { name: 'Connaught Place, New Delhi', lat: 28.6315, lng: 77.2167, radiusKm: 8 },
  { name: 'Mukarba Chowk, Delhi', lat: 28.7365, lng: 77.1510, radiusKm: 6 },
  { name: 'Murthal (Sukhdev Dhaba), Haryana', lat: 29.0264, lng: 77.0700, radiusKm: 5 },
  { name: 'Samalkha, Haryana', lat: 29.2330, lng: 77.0120, radiusKm: 6 },
  { name: 'Panipat Toll Plaza, Haryana', lat: 29.3909, lng: 76.9635, radiusKm: 8 },
  { name: 'Karnal Oasis Resort, Haryana', lat: 29.6857, lng: 76.9905, radiusKm: 8 },
  { name: 'Kurukshetra, Haryana', lat: 29.9695, lng: 76.8783, radiusKm: 8 },
  { name: 'Ambala Cantt Highway, Haryana', lat: 30.3782, lng: 76.7767, radiusKm: 10 },
  { name: 'Zirakpur Junction, Punjab', lat: 30.6425, lng: 76.8173, radiusKm: 7 },
  { name: 'Chandigarh Bypass', lat: 30.7333, lng: 76.7794, radiusKm: 10 },
  { name: 'Rupnagar (Ropar), Punjab', lat: 30.9664, lng: 76.5331, radiusKm: 8 },
  { name: 'Kiratpur Sahib, Punjab', lat: 31.1812, lng: 76.5684, radiusKm: 7 },
  { name: 'Swarghat, Himachal Pradesh', lat: 31.2333, lng: 76.7167, radiusKm: 7 },
  { name: 'Bilaspur Lake View, Himachal Pradesh', lat: 31.3400, lng: 76.7600, radiusKm: 8 },
  { name: 'Sundernagar, Himachal Pradesh', lat: 31.5333, lng: 76.9000, radiusKm: 8 },
  { name: 'Mandi Town, Himachal Pradesh', lat: 31.7087, lng: 76.9320, radiusKm: 8 },
  { name: 'Pandoh Dam, Himachal Pradesh', lat: 31.6700, lng: 77.0500, radiusKm: 6 },
  { name: 'Aut Tunnel, Himachal Pradesh', lat: 31.7333, lng: 77.2000, radiusKm: 6 },
  { name: 'Bhuntar Airport Area, Kullu', lat: 31.8764, lng: 77.1541, radiusKm: 6 },
  { name: 'Kullu Valley, Himachal Pradesh', lat: 31.9579, lng: 77.1095, radiusKm: 8 },
  { name: 'Naggar Castle Highway, Himachal', lat: 32.1158, lng: 77.1700, radiusKm: 6 },
  { name: 'Mall Road, Manali, Himachal Pradesh', lat: 32.2396, lng: 77.1887, radiusKm: 6 },
  { name: 'Old Manali, Himachal Pradesh', lat: 32.2548, lng: 77.1751, radiusKm: 5 },
  { name: 'Solang Valley, Manali', lat: 32.3166, lng: 77.1575, radiusKm: 6 }
];

function getApiKey() {
  return process.env.GEOAPIFY_API_KEY || process.env.GOOGLE_MAPS_API_KEY || '';
}

function isValidCoordinate(lat, lng) {
  return typeof lat === 'number' && typeof lng === 'number' &&
    !isNaN(lat) && !isNaN(lng) &&
    lat >= -90 && lat <= 90 &&
    lng >= -180 && lng <= 180;
}

export const mapService = {
  /**
   * Forward Geocoding: Converts an address/city text query into coordinates via Geoapify
   */
  async geocode(address) {
    if (!address || typeof address !== 'string' || address.trim().length === 0) {
      return null;
    }

    const cleanAddress = address.trim();
    const cacheKey = `geo:${cleanAddress.toLowerCase()}`;
    if (geocodeCache.has(cacheKey)) {
      return geocodeCache.get(cacheKey);
    }

    const apiKey = getApiKey();
    if (apiKey) {
      try {
        const url = `https://api.geoapify.com/v1/geocode/search?text=${encodeURIComponent(cleanAddress)}&apiKey=${apiKey}`;
        const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
        if (response.ok) {
          const data = await response.json();
          if (data.features && data.features.length > 0) {
            const first = data.features[0];
            const result = {
              latitude: first.properties.lat || first.geometry.coordinates[1],
              longitude: first.properties.lon || first.geometry.coordinates[0],
              formattedAddress: first.properties.formatted || cleanAddress,
              city: first.properties.city || first.properties.county || '',
              country: first.properties.country || ''
            };
            geocodeCache.set(cacheKey, result);
            return result;
          }
        }
      } catch (err) {
        console.warn('[MapService] Geoapify Geocoding API call failed:', err.message);
      }
    }

    // Fixed coordinates are available only for the explicitly enabled demo route.
    const matched = isDemoModeEnabled() && knownWaypoints.find(w => w.name.toLowerCase().includes(cleanAddress.toLowerCase()));
    if (matched) {
      const result = {
        latitude: matched.lat,
        longitude: matched.lng,
        formattedAddress: matched.name,
        city: '',
        country: 'India'
      };
      geocodeCache.set(cacheKey, result);
      return result;
    }

    return null;
  },

  /**
   * Reverse Geocode Lat/Lng into human-readable location name via Geoapify
   */
  async reverseGeocode(latitude, longitude) {
    if (!isValidCoordinate(latitude, longitude)) {
      return 'Location coordinates invalid';
    }

    const cacheKey = `${latitude.toFixed(4)},${longitude.toFixed(4)}`;
    if (geocodeCache.has(cacheKey)) {
      return geocodeCache.get(cacheKey);
    }

    const apiKey = getApiKey();

    if (apiKey) {
      try {
        const url = `https://api.geoapify.com/v1/geocode/reverse?lat=${latitude}&lon=${longitude}&apiKey=${apiKey}`;
        const response = await fetch(url, { signal: AbortSignal.timeout(5000) });

        if (response.ok) {
          const data = await response.json();
          if (data.features && data.features.length > 0) {
            const result = data.features[0];
            let placeName = result.properties.formatted;

            // Extract concise locality / landmark name
            if (result.properties.name) {
              const city = result.properties.city || result.properties.county || result.properties.state || '';
              placeName = city ? `${result.properties.name}, ${city}` : result.properties.name;
            } else if (result.properties.street) {
              const city = result.properties.city || result.properties.county || '';
              placeName = city ? `${result.properties.street}, ${city}` : result.properties.street;
            }

            geocodeCache.set(cacheKey, placeName);
            return placeName;
          }
        }
      } catch (err) {
        console.warn('[MapService] Geoapify Reverse Geocoding API call failed:', err.message);
      }
    }

    if (!isDemoModeEnabled()) {
      return 'Location unavailable';
    }

    // Demo-only match against known route points.
    let closest = null;
    let minDistance = Infinity;

    for (const wp of knownWaypoints) {
      const dist = haversineDistanceKm(latitude, longitude, wp.lat, wp.lng);
      if (dist < minDistance && dist <= wp.radiusKm) {
        minDistance = dist;
        closest = wp.name;
      }
    }

    if (closest) {
      geocodeCache.set(cacheKey, closest);
      return closest;
    }

    // Demo-only descriptive fallback
    const fallback = `Highway Point (${latitude.toFixed(3)}°N, ${longitude.toFixed(3)}°E)`;
    geocodeCache.set(cacheKey, fallback);
    return fallback;
  },

  /**
   * Calculate Route Polyline & details between Origin and Destination via Geoapify
   */
  async calculateRoute(origin, destination) {
    const originLat = typeof origin === 'object' ? origin.lat : null;
    const originLng = typeof origin === 'object' ? origin.lng : null;
    const destLat = typeof destination === 'object' ? destination.lat : null;
    const destLng = typeof destination === 'object' ? destination.lng : null;

    const apiKey = getApiKey();

    if (apiKey && isValidCoordinate(originLat, originLng) && isValidCoordinate(destLat, destLng)) {
      try {
        const url = `https://api.geoapify.com/v1/routing?waypoints=${originLat},${originLng}|${destLat},${destLng}&mode=drive&apiKey=${apiKey}`;
        const response = await fetch(url, { signal: AbortSignal.timeout(6000) });

        if (response.ok) {
          const data = await response.json();
          if (data.features && data.features.length > 0) {
            const routeProps = data.features[0].properties;
            const distKm = Math.round(routeProps.distance / 1000);
            const timeSec = routeProps.time;
            const hours = Math.floor(timeSec / 3600);
            const mins = Math.round((timeSec % 3600) / 60);

            return {
              polyline: '',
              distance: `${distKm} km`,
              duration: `${hours} hours ${mins} mins`,
              start_address: typeof origin === 'string' ? origin : 'Origin Point',
              end_address: typeof destination === 'string' ? destination : 'Destination Point',
              start_location: { lat: originLat, lng: originLng },
              end_location: { lat: destLat, lng: destLng }
            };
          }
        }
      } catch (err) {
        console.warn('[MapService] Geoapify Routing API failed:', err.message);
      }
    }

    if (!isDemoModeEnabled() || !isValidCoordinate(originLat, originLng) || !isValidCoordinate(destLat, destLng)) {
      return null;
    }

    // Demo-only approximate route metrics.
    const distanceKm = Math.round(haversineDistanceKm(originLat, originLng, destLat, destLng) * 1.25);
    const estimatedHours = Math.round(distanceKm / 45);

    return {
      distance: `${distanceKm} km`,
      duration: `${estimatedHours} hours`,
      start_address: typeof origin === 'string' ? origin : 'Demo origin',
      end_address: typeof destination === 'string' ? destination : 'Demo destination',
      start_location: { lat: originLat, lng: originLng },
      end_location: { lat: destLat, lng: destLng },
      waypoints: knownWaypoints.map(w => ({ lat: w.lat, lng: w.lng, name: w.name }))
    };
  },

  /**
   * Calculate ETA for an individual from current coordinate to destination
   */
  calculateIndividualEta(currentLat, currentLng, destLat, destLng, currentSpeedKmh = 45) {
    if (!isValidCoordinate(currentLat, currentLng) || !isValidCoordinate(destLat, destLng)) {
      return {
        distanceKm: 0,
        totalMinutes: 0,
        formattedEta: 'N/A',
        arrivalTimestamp: new Date().toISOString()
      };
    }

    const distanceKm = haversineDistanceKm(currentLat, currentLng, destLat, destLng);
    const roadDistanceKm = distanceKm * 1.25;

    let effectiveSpeed = currentSpeedKmh > 10 ? currentSpeedKmh : 40;
    if (currentLat > 31.2) {
      effectiveSpeed = Math.min(effectiveSpeed, 35);
    }

    const hours = roadDistanceKm / effectiveSpeed;
    const totalMinutes = Math.round(hours * 60);

    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;

    return {
      distanceKm: Math.round(roadDistanceKm * 10) / 10,
      totalMinutes,
      formattedEta: h > 0 ? `${h}h ${m}m` : `${m} mins`,
      arrivalTimestamp: new Date(Date.now() + totalMinutes * 60 * 1000).toISOString()
    };
  },

  /**
   * Calculate Clustered Group ETA
   */
  calculateGroupEta(activeMembers, destLat, destLng) {
    if (!activeMembers || activeMembers.length === 0) {
      return { formattedEta: 'Calculating...', totalMinutes: 0 };
    }

    const memberEtas = activeMembers.map(m => {
      const eta = this.calculateIndividualEta(
        m.latitude,
        m.longitude,
        destLat,
        destLng,
        m.speed || 40
      );
      return eta.totalMinutes;
    });

    memberEtas.sort((a, b) => a - b);
    const slowestIndex = Math.min(memberEtas.length - 1, Math.floor(memberEtas.length * 0.8));
    const groupMinutes = memberEtas[slowestIndex];

    const h = Math.floor(groupMinutes / 60);
    const m = groupMinutes % 60;

    return {
      formattedEta: h > 0 ? `${h}h ${m}m` : `${m} mins`,
      totalMinutes: groupMinutes,
      arrivalTimestamp: new Date(Date.now() + groupMinutes * 60 * 1000).toISOString()
    };
  },

  /**
   * Search Nearby POIs (Petrol Stations and Hotels) around a geographic point using Geoapify Places API
   */
  async searchNearbyPOIs(latitude, longitude, radiusMeters = 1500) {
    if (!isValidCoordinate(latitude, longitude)) return [];

    const cacheKey = `poi:${latitude.toFixed(3)},${longitude.toFixed(3)}:${radiusMeters}`;
    if (poiCache.has(cacheKey)) {
      return poiCache.get(cacheKey);
    }

    const apiKey = getApiKey();
    const categories = ['service.vehicle.fuel', 'accommodation.hotel'];

    if (apiKey) {
      try {
        const url = `https://api.geoapify.com/v2/places?categories=${categories.join(',')}&filter=circle:${longitude},${latitude},${radiusMeters}&limit=12&apiKey=${apiKey}`;
        const response = await fetch(url, { signal: AbortSignal.timeout(5000) });

        if (response.ok) {
          const data = await response.json();
          if (data.features && data.features.length > 0) {
            const pois = data.features.map(f => {
              const p = f.properties;
              const isFuel = (p.categories || []).some(c => c.includes('fuel') || c.includes('gas'));
              const isHotel = (p.categories || []).some(c => c.includes('hotel') || c.includes('accommodation'));
              const distance = p.distance || Math.round(haversineDistanceKm(latitude, longitude, p.lat, p.lon) * 1000);

              return {
                id: p.place_id || `${p.lat},${p.lon}`,
                name: p.name || (isFuel ? 'Petrol Station' : 'Hotel / Lodging'),
                type: isFuel ? 'petrol' : isHotel ? 'hotel' : 'other',
                categoryText: isFuel ? 'Petrol Station' : 'Hotel',
                icon: isFuel ? '⛽' : '🏨',
                latitude: p.lat,
                longitude: p.lon,
                distanceMeters: distance,
                distanceText: distance < 1000 ? `${distance} m` : `${(distance / 1000).toFixed(1)} km`,
                address: p.formatted || p.address_line2 || ''
              };
            });

            poiCache.set(cacheKey, pois);
            return pois;
          }
        }
      } catch (err) {
        console.warn('[MapService] Geoapify Places API call failed:', err.message);
      }
    }

    if (!isDemoModeEnabled()) return [];

    // Demo-only curated corridor POIs for NH44 / NH21.
    const corridorPOIs = [
      { name: 'HP Petrol Pump (Sukhdev Hub)', type: 'petrol', icon: '⛽', lat: 29.0270, lng: 77.0710, address: 'NH44, Murthal' },
      { name: 'IndianOil Fuel Station', type: 'petrol', icon: '⛽', lat: 29.0255, lng: 77.0690, address: 'Murthal Chowk' },
      { name: 'Hotel Highway King', type: 'hotel', icon: '🏨', lat: 29.0280, lng: 77.0725, address: 'Murthal Corridor' },
      { name: 'Bharat Petroleum Oasis', type: 'petrol', icon: '⛽', lat: 29.6860, lng: 76.9910, address: 'Karnal Tollway' },
      { name: 'Karnal Haveli Resort', type: 'hotel', icon: '🏨', lat: 29.6870, lng: 76.9920, address: 'GT Road, Karnal' },
      { name: 'IndianOil Swarghat Hub', type: 'petrol', icon: '⛽', lat: 31.2340, lng: 76.7180, address: 'NH21 Swarghat' },
      { name: 'Himachal Tourism Hotel', type: 'hotel', icon: '🏨', lat: 31.3410, lng: 76.7610, address: 'Bilaspur' },
      { name: 'HP Petrol Pump Mandi', type: 'petrol', icon: '⛽', lat: 31.7090, lng: 76.9330, address: 'Mandi By-Pass' },
      { name: 'River View Resort', type: 'hotel', icon: '🏨', lat: 31.9590, lng: 77.1105, address: 'Kullu Valley' },
      { name: 'IndianOil Mall Road', type: 'petrol', icon: '⛽', lat: 32.2380, lng: 77.1870, address: 'Manali Town' },
      { name: 'Snow Valley Resort', type: 'hotel', icon: '🏨', lat: 32.2400, lng: 77.1895, address: 'Mall Road, Manali' }
    ];

    const matched = [];
    for (const cp of corridorPOIs) {
      const distM = Math.round(haversineDistanceKm(latitude, longitude, cp.lat, cp.lng) * 1000);
      if (distM <= radiusMeters) {
        matched.push({
          id: `fallback-${cp.lat}-${cp.lng}`,
          name: cp.name,
          type: cp.type,
          categoryText: cp.type === 'petrol' ? 'Petrol Station' : 'Hotel',
          icon: cp.icon,
          latitude: cp.lat,
          longitude: cp.lng,
          distanceMeters: distM,
          distanceText: distM < 1000 ? `${distM} m` : `${(distM / 1000).toFixed(1)} km`,
          address: cp.address
        });
      }
    }

    poiCache.set(cacheKey, matched);
    return matched;
  },

  /**
   * Search Route Corridor POIs along highway
   */
  async searchRouteCorridorPOIs(originLat, originLng, destLat, destLng) {
    if (!isDemoModeEnabled()) return [];

    const defaultPOIs = [
      { id: 'poi-murthal-fuel', name: 'HP Petrol Pump (Sukhdev Hub)', type: 'FUEL', categoryText: 'Petrol Station', icon: '⛽', latitude: 29.0270, longitude: 77.0710, address: 'NH44 Murthal, Haryana' },
      { id: 'poi-murthal-hotel', name: 'Hotel Highway King', type: 'HOTEL', categoryText: 'Hotel', icon: '🏨', latitude: 29.0280, longitude: 77.0725, address: 'Murthal Corridor, Haryana' },
      { id: 'poi-karnal-fuel', name: 'Bharat Petroleum Oasis', type: 'FUEL', categoryText: 'Petrol Station', icon: '⛽', latitude: 29.6860, longitude: 76.9910, address: 'Karnal Highway Oasis' },
      { id: 'poi-karnal-hotel', name: 'Karnal Haveli Resort', type: 'HOTEL', categoryText: 'Hotel', icon: '🏨', latitude: 29.6870, longitude: 76.9920, address: 'GT Road, Karnal' },
      { id: 'poi-swarghat-fuel', name: 'IndianOil Swarghat Hub', type: 'FUEL', categoryText: 'Petrol Station', icon: '⛽', latitude: 31.2340, longitude: 76.7180, address: 'NH21 Swarghat, HP' },
      { id: 'poi-bilaspur-hotel', name: 'Himachal Tourism Hotel', type: 'HOTEL', categoryText: 'Hotel', icon: '🏨', latitude: 31.3410, longitude: 76.7610, address: 'Bilaspur Lake Road' },
      { id: 'poi-mandi-fuel', name: 'HP Petrol Pump Mandi', type: 'FUEL', categoryText: 'Petrol Station', icon: '⛽', latitude: 31.7090, longitude: 76.9330, address: 'Mandi Highway By-Pass' },
      { id: 'poi-kullu-hotel', name: 'River View Resort', type: 'HOTEL', categoryText: 'Hotel', icon: '🏨', latitude: 31.9590, longitude: 77.1105, address: 'Kullu Valley Highway' },
      { id: 'poi-manali-fuel', name: 'IndianOil Fuel Station', type: 'FUEL', categoryText: 'Petrol Station', icon: '⛽', latitude: 32.2380, longitude: 77.1870, address: 'Mall Road Approach, Manali' },
      { id: 'poi-manali-hotel', name: 'Snow Valley Resort', type: 'HOTEL', categoryText: 'Hotel', icon: '🏨', latitude: 32.2400, longitude: 77.1895, address: 'Mall Road, Manali' }
    ];
    return defaultPOIs;
  }
};

export default mapService;
