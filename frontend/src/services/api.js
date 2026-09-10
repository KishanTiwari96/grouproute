const API_BASE = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_URL) || 'http://localhost:5000';

async function request(endpoint, options = {}) {
  const token = localStorage.getItem('grouproute_token');
  const headers = {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
    ...options.headers,
  };

  const config = {
    ...options,
    headers,
  };

  const response = await fetch(`${API_BASE}${endpoint}`, config);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Network request failed');
  }

  return data;
}

export const api = {
  // Auth
  register: (body) => request('/api/auth/register', { method: 'POST', body: JSON.stringify(body) }),
  login: (body) => request('/api/auth/login', { method: 'POST', body: JSON.stringify(body) }),
  getMe: () => request('/api/auth/me'),
  updateProfile: (body) => request('/api/auth/profile', { method: 'PUT', body: JSON.stringify(body) }),

  // Groups
  getGroups: () => request('/api/groups'),
  createGroup: (body) => request('/api/groups', { method: 'POST', body: JSON.stringify(body) }),
  joinGroup: (body) => request('/api/groups/join', { method: 'POST', body: JSON.stringify(body) }),
  getGroupDetails: (groupId) => request(`/api/groups/${groupId}`),
  removeMember: (groupId, userId) => request(`/api/groups/${groupId}/members/${userId}`, { method: 'DELETE' }),

  // Trips
  getActiveTrips: () => request('/api/trips/active'),
  getRecommendedTrips: () => request('/api/trips/recommended'),
  createTrip: (body) => request('/api/trips', { method: 'POST', body: JSON.stringify(body) }),
  getTripDetails: (tripId) => request(`/api/trips/${tripId}`),
  startTrip: (tripId) => request(`/api/trips/${tripId}/start`, { method: 'POST' }),
  endTrip: (tripId) => request(`/api/trips/${tripId}/end`, { method: 'POST' }),
  getTripTimeline: (tripId) => request(`/api/trips/${tripId}/timeline`),
  getTripStops: (tripId) => request(`/api/trips/${tripId}/stops`),
  getTripPOIs: (tripId) => request(`/api/trips/${tripId}/pois`),
  getTripLocations: (tripId) => request(`/api/trips/${tripId}/locations`),
  getTripHistory: (tripId) => tripId ? request(`/api/trips/${tripId}/location-history`) : request('/api/trips/history'),
  getTripStats: () => request('/api/trips/stats'),
  getTripLocationHistory: (tripId) => request(`/api/trips/${tripId}/location-history`),
  syncLocations: (tripId, locations) => request(`/api/trips/${tripId}/locations/sync`, { method: 'POST', body: JSON.stringify({ locations }) }),

  // Routes
  calculateRoute: (body) => request('/api/routes/calculate', { method: 'POST', body: JSON.stringify(body) }),
};

export default api;
