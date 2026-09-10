import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, useLocation, Link } from 'react-router-dom';
import { Navigation, MapPin, Calendar, Clock, ArrowRight, ArrowLeft, Route, Check, Plus, UserPlus, Sparkles } from 'lucide-react';
import api from '../services/api.js';
import useTripStore from '../store/tripStore.js';
import CreateGroupModal from './CreateGroupModal.jsx';
import JoinGroupModal from './JoinGroupModal.jsx';
import LocationInput from '../components/common/LocationInput.jsx';

// Popular road trip presets for quick 1-click selection
const tripPresets = [
  {
    name: 'Delhi to Manali Expedition',
    origin: 'Connaught Place, New Delhi',
    destination: 'Mall Road, Manali, Himachal Pradesh',
    origin_lat: 28.6315,
    origin_lng: 77.2167,
    destination_lat: 32.2396,
    destination_lng: 77.1887,
    distance: '535 km',
    duration: '11h 30m'
  },
  {
    name: 'Mumbai to Goa Scenic Coastal Highway',
    origin: 'Bandra West, Mumbai',
    destination: 'Panaji, Goa',
    origin_lat: 19.0596,
    origin_lng: 72.8295,
    destination_lat: 15.4909,
    destination_lng: 73.8278,
    distance: '585 km',
    duration: '10h 45m'
  },
  {
    name: 'Bengaluru to Coorg Coffee Trails',
    origin: 'Indiranagar, Bengaluru',
    destination: 'Madikeri, Coorg, Karnataka',
    origin_lat: 12.9716,
    origin_lng: 77.5946,
    destination_lat: 12.4244,
    destination_lng: 75.7382,
    distance: '248 km',
    duration: '5h 15m'
  }
];

export function CreateTrip() {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const initialGroupId = searchParams.get('group') || '';
  const navigate = useNavigate();

  const [groups, setGroups] = useState([]);
  const [groupId, setGroupId] = useState(initialGroupId);
  const [tripName, setTripName] = useState('Delhi to Manali Road Trip');
  
  const [originLoc, setOriginLoc] = useState({
    address: 'Connaught Place, New Delhi',
    lat: 28.6315,
    lng: 77.2167
  });
  
  const [destLoc, setDestLoc] = useState({
    address: 'Mall Road, Manali, Himachal Pradesh',
    lat: 32.2396,
    lng: 77.1887
  });

  const [distance, setDistance] = useState('535 km');
  const [duration, setDuration] = useState('11h 30m');
  const [routeAlternatives, setRouteAlternatives] = useState([]);
  const [selectedRouteIndex, setSelectedRouteIndex] = useState(0);
  const [isRouting, setIsRouting] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingGroups, setIsLoadingGroups] = useState(true);
  const [error, setError] = useState('');

  const [isCreateGroupOpen, setIsCreateGroupOpen] = useState(false);
  const [isJoinGroupOpen, setIsJoinGroupOpen] = useState(false);

  useEffect(() => {
    const recommendation = location.state?.recommendation;
    if (!recommendation) return;

    setTripName(recommendation.name || 'Recommended Road Trip');
    setOriginLoc({ address: recommendation.origin, lat: recommendation.origin_lat, lng: recommendation.origin_lng });
    setDestLoc({ address: recommendation.destination, lat: recommendation.destination_lat, lng: recommendation.destination_lng });
  }, [location.state]);

  const fetchGroups = async () => {
    setIsLoadingGroups(true);
    try {
      const data = await api.getGroups();
      const loadedGroups = data.groups || [];
      setGroups(loadedGroups);
      if (loadedGroups.length > 0) {
        if (!groupId || !loadedGroups.some(g => g.id === groupId)) {
          setGroupId(loadedGroups[0].id);
        }
      }
    } catch (err) {
      console.error('Failed to load groups:', err);
    } finally {
      setIsLoadingGroups(false);
    }
  };

  useEffect(() => {
    fetchGroups();
  }, []);

  // Recalculate route whenever valid origin & destination are provided
  useEffect(() => {
    const normalizedOrigin = originLoc && Number.isFinite(Number(originLoc.lat)) && Number.isFinite(Number(originLoc.lng))
      ? { ...originLoc, lat: Number(originLoc.lat), lng: Number(originLoc.lng) }
      : null;
    const normalizedDestination = destLoc && Number.isFinite(Number(destLoc.lat)) && Number.isFinite(Number(destLoc.lng))
      ? { ...destLoc, lat: Number(destLoc.lat), lng: Number(destLoc.lng) }
      : null;

    if (normalizedOrigin && normalizedDestination) {
      setIsRouting(true);
      fetch(`https://router.project-osrm.org/route/v1/driving/${normalizedOrigin.lng},${normalizedOrigin.lat};${normalizedDestination.lng},${normalizedDestination.lat}?overview=full&geometries=geojson&alternatives=3`)
        .then(res => res.json())
        .then(data => {
          if (data.code === 'Ok' && data.routes.length > 0) {
            const alternatives = data.routes.map((r, index) => {
              const distKm = Math.round(r.distance / 1000);
              const mins = Math.round(r.duration / 60);
              const hrs = Math.floor(mins / 60);
              const remainingMins = mins % 60;

              let summary = r.legs?.[0]?.summary || `Route Option ${index + 1}`;
              if (!summary || summary === '') {
                summary = index === 0 ? 'Fastest Route' : `Alternative Route ${index}`;
              }

              const coords = Array.isArray(r.geometry?.coordinates)
                ? r.geometry.coordinates.map(([lng, lat]) => [lat, lng])
                : [];

              return {
                summary,
                distance: `${distKm} km`,
                duration: hrs > 0 ? `${hrs}h ${remainingMins}m` : `${remainingMins}m`,
                polyline: JSON.stringify(coords)
              };
            });

            setRouteAlternatives(alternatives);
            setSelectedRouteIndex(0);
            setDistance(alternatives[0].distance);
            setDuration(alternatives[0].duration);
          } else {
            setRouteAlternatives([]);
            setDistance('-- km');
            setDuration('-- h -- m');
          }
        })
        .catch(err => {
          console.error('OSRM Route calculation failed', err);
          setRouteAlternatives([]);
          setDistance('-- km');
          setDuration('-- h -- m');
        })
        .finally(() => setIsRouting(false));
    } else {
      setRouteAlternatives([]);
      setDistance('-- km');
      setDuration('-- h -- m');
    }
  }, [originLoc, destLoc]);

  const handleRouteSelect = (idx) => {
    setSelectedRouteIndex(idx);
    setDistance(routeAlternatives[idx].distance);
    setDuration(routeAlternatives[idx].duration);
  };

  const handleGroupCreatedOrJoined = (newGroup) => {
    if (newGroup && newGroup.id) {
      setGroups((prev) => {
        const exists = prev.some(g => g.id === newGroup.id);
        if (exists) return prev;
        return [newGroup, ...prev];
      });
      setGroupId(newGroup.id);
      setError('');
    }
    fetchGroups();
  };

  const handleQuickCreateGroup = async () => {
    setIsLoading(true);
    setError('');
    try {
      const data = await api.createGroup({ name: 'Himalayan Convoy 2026' });
      if (data.group) {
        handleGroupCreatedOrJoined(data.group);
      }
    } catch (err) {
      setError(err.message || 'Failed to create group');
    } finally {
      setIsLoading(false);
    }
  };

  const handleApplyPreset = (preset) => {
    setTripName(preset.name);
    setOriginLoc({
      address: preset.origin,
      lat: preset.origin_lat,
      lng: preset.origin_lng
    });
    setDestLoc({
      address: preset.destination,
      lat: preset.destination_lat,
      lng: preset.destination_lng
    });
    // Distance and duration will auto-update via the useEffect!
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!groupId) {
      setError('Please select or create a travel group first.');
      return;
    }
    const normalizedOrigin = originLoc && Number.isFinite(Number(originLoc.lat)) && Number.isFinite(Number(originLoc.lng))
      ? { ...originLoc, lat: Number(originLoc.lat), lng: Number(originLoc.lng) }
      : null;
    const normalizedDestination = destLoc && Number.isFinite(Number(destLoc.lat)) && Number.isFinite(Number(destLoc.lng))
      ? { ...destLoc, lat: Number(destLoc.lat), lng: Number(destLoc.lng) }
      : null;

    if (!normalizedOrigin || !normalizedDestination) {
      setError('Please select valid origin and destination locations.');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      console.log('[CreateTrip] Sending trip data payload:', {
        origin: originLoc.address,
        origin_lat: originLoc.lat,
        origin_lng: originLoc.lng,
        destination: destLoc.address,
        destination_lat: destLoc.lat,
        destination_lng: destLoc.lng,
        distance,
        estimated_duration: duration
      });

      const data = await api.createTrip({
        group_id: groupId,
        name: tripName.trim(),
        origin: normalizedOrigin.address.trim(),
        destination: normalizedDestination.address.trim(),
        origin_lat: normalizedOrigin.lat,
        origin_lng: normalizedOrigin.lng,
        destination_lat: normalizedDestination.lat,
        destination_lng: normalizedDestination.lng,
        distance,
        estimated_duration: duration,
        route_polyline: routeAlternatives[selectedRouteIndex]?.polyline || ''
      });

      if (!data || !data.trip || !data.trip.id) {
        throw new Error('Trip was created but no trip ID was returned by server.');
      }

      // Automatically activate trip for immediate live convoy tracking
      try {
        await api.startTrip(data.trip.id);
      } catch (startErr) {
        console.warn('Trip created, start warning:', startErr);
      }

      // Explicitly wipe any lingering simulation or map state from the previous trip
      useTripStore.getState().resetTrip();

      navigate(`/trips/${data.trip.id}`);
    } catch (err) {
      console.error('[CreateTrip] Error creating trip:', err);
      setError(err.message || 'Failed to create trip. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 relative z-10">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          to="/dashboard"
          className="p-2 rounded-full hover:bg-[#e8eaed] text-[#5f6368] transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <span className="text-[10px] uppercase tracking-[0.1em] text-[#5f6368] font-bold block mb-0.5">New Journey</span>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#202124] leading-tight">Plan Group Road Trip</h1>
        </div>
      </div>

      {/* Quick Highway Presets */}
      <div>
        <span className="text-xs font-bold text-[#5f6368] block mb-2.5">
          Select a Popular Highway Route Preset:
        </span>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {tripPresets.map((preset, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleApplyPreset(preset)}
              className={`p-4 rounded-xl text-left transition-all transform hover:-translate-y-0.5 ${
                tripName === preset.name
                  ? 'bg-white shadow-[0_1px_3px_1px_rgba(26,115,232,0.15),0_1px_2px_0_rgba(26,115,232,0.3)] ring-2 ring-[#1a73e8]'
                  : 'bg-white shadow-[0_1px_2px_0_rgba(60,64,67,0.3),0_1px_3px_1px_rgba(60,64,67,0.15)] hover:shadow-[0_2px_6px_2px_rgba(60,64,67,0.15),0_1px_2px_0_rgba(60,64,67,0.3)]'
              }`}
            >
              <div className="flex items-start gap-2">
                <Route className="w-4 h-4 text-[#1a73e8] shrink-0 mt-0.5" />
                <p className="text-sm font-bold text-[#202124] leading-snug">{preset.name}</p>
              </div>
              <div className="flex items-center justify-between text-xs text-[#5f6368] mt-3">
                <span className="font-mono">{preset.distance}</span>
                <span className="bg-[#e8f0fe] text-[#1a73e8] px-2 py-0.5 rounded-full font-bold font-mono">{preset.duration}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Trip Form */}
      <div className="bg-white p-6 sm:p-8 rounded-3xl shadow-[0_1px_2px_0_rgba(60,64,67,0.3),0_1px_3px_1px_rgba(60,64,67,0.15)]">
        {error && (
          <div className="mb-6 p-3 rounded-2xl bg-[#fce8e6] border border-[#fad2cf] text-[#c5221f] text-xs font-bold">
            {error}
          </div>
        )}

        <form onSubmit={handleCreate} className="space-y-6">
          {/* Group Selector */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-bold text-[#3c4043]">Select Travel Group</label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsJoinGroupOpen(true)}
                  className="text-sm font-bold text-[#1a73e8] hover:text-[#1557d0] flex items-center gap-1.5 p-1 transition-colors"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>Join Code</span>
                </button>
                <span className="text-[#dadce0]">·</span>
                <button
                  type="button"
                  onClick={() => setIsCreateGroupOpen(true)}
                  className="text-sm font-bold text-[#1a73e8] hover:text-[#1557d0] flex items-center gap-1.5 p-1 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  <span>New Group</span>
                </button>
              </div>
            </div>

            {groups.length === 0 ? (
              <div className="p-5 rounded-xl bg-white shadow-[0_1px_2px_0_rgba(60,64,67,0.3),0_1px_3px_1px_rgba(60,64,67,0.15)] space-y-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-[#f1f3f4] rounded-full text-[#5f6368] shrink-0 mt-0.5">
                    <UserPlus className="w-5 h-5" />
                  </div>
                  <span className="text-sm text-[#5f6368] leading-relaxed">
                    No travel groups found. Create or join a group to start planning your road trip.
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-3 pl-11">
                  <button
                    type="button"
                    onClick={() => setIsCreateGroupOpen(true)}
                    className="px-4 py-2 rounded-full bg-[#1a73e8] hover:bg-[#1557d0] text-white text-sm font-bold shadow-[0_1px_2px_0_rgba(60,64,67,0.3),0_1px_3px_1px_rgba(60,64,67,0.15)] transition-all flex items-center gap-1.5"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Create Travel Group</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleQuickCreateGroup}
                    className="px-4 py-2 rounded-full bg-white hover:bg-[#f8f9fa] text-[#3c4043] text-sm font-bold transition-all flex items-center gap-1.5 shadow-[0_1px_2px_0_rgba(60,64,67,0.3),0_1px_3px_1px_rgba(60,64,67,0.15)]"
                  >
                    <Sparkles className="w-4 h-4 text-[#f9ab00]" />
                    <span>Quick Create Demo Group</span>
                  </button>
                </div>
              </div>
            ) : (
              <select
                value={groupId}
                onChange={(e) => setGroupId(e.target.value)}
                className="w-full px-4 py-3 rounded-[10px] bg-white border border-[#dadce0] text-[#202124] text-sm focus:outline-none focus:border-[#1a73e8] focus:shadow-[0_0_0_2px_rgba(26,115,232,0.2)] transition-shadow"
              >
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name} (Code: {g.invite_code}) {g.isOwner ? '• Owner' : '• Member'}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Trip Name */}
          <div>
            <label className="block text-sm font-bold text-[#3c4043] mb-2">Trip Name</label>
            <input
              type="text"
              required
              value={tripName}
              onChange={(e) => setTripName(e.target.value)}
              placeholder="e.g. Manali Expedition 2026"
              className="w-full px-4 py-3 rounded-[10px] bg-white border border-[#dadce0] text-[#202124] placeholder-[#80868b] text-sm focus:outline-none focus:border-[#1a73e8] focus:shadow-[0_0_0_2px_rgba(26,115,232,0.2)] transition-shadow"
            />
          </div>

          {/* Origin & Destination */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <LocationInput
                label="Origin"
                placeholder="Starting point"
                value={originLoc}
                onChange={setOriginLoc}
                iconColor="text-[#1e8e3e]"
              />
            </div>

            <div>
              <LocationInput
                label="Destination"
                placeholder="Final Destination"
                value={destLoc}
                onChange={setDestLoc}
                iconColor="text-[#d93025]"
              />
            </div>
          </div>

          {/* Route Preview Summary Card */}
          <div className="bg-[#e8f0fe] p-5 rounded-[12px] flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-2">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-full bg-white text-[#1a73e8] shadow-sm">
                <Route className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-bold text-[#1a73e8]">Estimated Route Summary</p>
                <p className="text-xs text-[#1a73e8]/80 mt-0.5">Calculated via Road Geodesic Matrix</p>
              </div>
            </div>

            <div className="flex items-center gap-6 sm:text-right">
              <div>
                <span className="text-xs text-[#1a73e8]/80 uppercase block font-medium mb-0.5">Distance</span>
                <span className="font-mono text-lg font-bold text-[#1a73e8]">{isRouting ? '...' : distance}</span>
              </div>
              <div>
                <span className="text-xs text-[#1a73e8]/80 uppercase block font-medium mb-0.5">Est. Time</span>
                <span className="font-mono text-lg font-bold text-[#1a73e8] flex items-center gap-1.5">
                  <Clock className="w-4 h-4" />
                  {isRouting ? '...' : duration}
                </span>
              </div>
            </div>
          </div>

          {/* Route Alternatives Selection */}
          {!isRouting && routeAlternatives.length > 0 && (
            <div className="space-y-3 mt-6">
              <label className="block text-sm font-bold text-[#3c4043]">Select Planned Route</label>
              <div className="flex flex-col gap-3">
                {routeAlternatives.map((alt, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleRouteSelect(idx)}
                    className={`flex items-center justify-between p-4 rounded-xl text-left transition-all ${
                      selectedRouteIndex === idx
                        ? 'bg-[#e8f0fe] shadow-[0_1px_3px_1px_rgba(26,115,232,0.15),0_1px_2px_0_rgba(26,115,232,0.3)] ring-2 ring-[#1a73e8]'
                        : 'bg-white shadow-[0_1px_2px_0_rgba(60,64,67,0.3),0_1px_3px_1px_rgba(60,64,67,0.15)] hover:shadow-[0_2px_6px_2px_rgba(60,64,67,0.15),0_1px_2px_0_rgba(60,64,67,0.3)]'
                    }`}
                  >
                    <div>
                      <p className={`text-sm font-bold ${selectedRouteIndex === idx ? 'text-[#1a73e8]' : 'text-[#202124]'} leading-snug`}>
                        {alt.summary} {idx === 0 && <span className="ml-2 text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-[#34a853] text-white">Fastest</span>}
                      </p>
                      <p className="text-xs text-[#5f6368] mt-1 flex items-center gap-2">
                        <span>{alt.distance}</span>
                        <span className="w-1 h-1 rounded-full bg-[#dadce0]"></span>
                        <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {alt.duration}</span>
                      </p>
                    </div>
                    {selectedRouteIndex === idx && (
                      <div className="shrink-0 w-5 h-5 rounded-full bg-[#1a73e8] text-white flex items-center justify-center">
                        <Check className="w-3.5 h-3.5" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading || !groupId || !originLoc || !destLoc || distance === '-- km' || distance === 'Unknown'}
            className="w-full py-3.5 mt-2 rounded-full bg-[#1a73e8] hover:bg-[#1557d0] hover:shadow-[0_2px_6px_2px_rgba(60,64,67,0.15),0_1px_2px_0_rgba(60,64,67,0.3)] text-white font-bold text-base shadow-[0_1px_2px_0_rgba(60,64,67,0.3),0_1px_3px_1px_rgba(60,64,67,0.15)] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span>{isLoading ? 'Creating Trip...' : 'Create & Proceed to Live Map'}</span>
            <ArrowRight className="w-5 h-5" />
          </button>
        </form>
      </div>

      {/* Modals */}
      <CreateGroupModal
        isOpen={isCreateGroupOpen}
        onClose={() => setIsCreateGroupOpen(false)}
        onGroupCreated={handleGroupCreatedOrJoined}
      />
      <JoinGroupModal
        isOpen={isJoinGroupOpen}
        onClose={() => setIsJoinGroupOpen(false)}
        onGroupJoined={handleGroupCreatedOrJoined}
      />
    </div>
  );
}

export default CreateTrip;
