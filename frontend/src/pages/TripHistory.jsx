import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle2,
  Navigation,
  Award,
  Users,
  MapPin,
  Calendar,
  ChevronRight,
  Route
} from 'lucide-react';
import api from '../services/api.js';

export function TripHistory() {
  const [trips, setTrips] = useState([]);
  const [stats, setStats] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function loadHistoryAndStats() {
      try {
        setIsLoading(true);
        setError(null);
        const [historyRes, statsRes] = await Promise.all([
          api.getTripHistory(),
          api.getTripStats()
        ]);
        setTrips(historyRes.trips || []);
        setStats(statsRes || null);
      } catch (err) {
        console.error('[TripHistory] Fetch error:', err);
        setError(err.message || 'Failed to load trip history and statistics.');
      } finally {
        setIsLoading(false);
      }
    }

    loadHistoryAndStats();
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center bg-[#f8f9fa] text-[#5f6368]">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-4 border-[#1a73e8] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm font-medium text-[#202124]">Loading trip history & statistics...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-[#fce8e6] border border-[#fad2cf] rounded-2xl p-6 text-center text-[#d93025]">
          <p className="font-bold text-base mb-2">Could not load trip history</p>
          <p className="text-sm">{error}</p>
          <Link
            to="/dashboard"
            className="inline-block mt-4 px-4 py-2 bg-[#1a73e8] text-white font-bold text-xs rounded-full hover:bg-[#1557d0] transition-colors"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const tripsCompleted = stats?.tripsCompleted || 0;
  const totalDistanceKm = stats?.totalDistanceKm || 0;
  const longestTrip = stats?.longestTrip;
  const topCompanion = stats?.topCompanion;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
      {/* Header & Back Link */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            to="/dashboard"
            title="Back to Dashboard"
            className="p-2 rounded-full text-[#5f6368] hover:text-[#202124] hover:bg-white transition-colors bg-white shadow-xs border border-[#dadce0]"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#202124]">
              Trip History & Statistics
            </h1>
            <p className="text-xs sm:text-sm text-[#5f6368] mt-0.5">
              Summary of your completed group routes, mileage, and convoy companions
            </p>
          </div>
        </div>

        <Link
          to="/dashboard"
          className="self-start sm:self-auto text-xs font-bold text-[#1a73e8] hover:text-[#1557d0] bg-[#e8f0fe] px-3.5 py-1.5 rounded-full transition-colors"
        >
          Dashboard View
        </Link>
      </div>

      {/* 4 Stat Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Trips Completed */}
        <div className="bg-white rounded-xl p-5 shadow-[0_1px_2px_0_rgba(60,64,67,0.3),0_1px_3px_1px_rgba(60,64,67,0.15)] flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#5f6368]">
              Trips Completed
            </span>
            <div className="w-8 h-8 rounded-lg bg-[#e8f0fe] flex items-center justify-center text-[#1a73e8]">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <p className="text-2xl sm:text-3xl font-bold text-[#202124] font-mono">
              {tripsCompleted}
            </p>
            <p className="text-xs text-[#5f6368] mt-1">
              Finished group routes
            </p>
          </div>
        </div>

        {/* Card 2: Total Distance */}
        <div className="bg-white rounded-xl p-5 shadow-[0_1px_2px_0_rgba(60,64,67,0.3),0_1px_3px_1px_rgba(60,64,67,0.15)] flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#5f6368]">
              Total Distance
            </span>
            <div className="w-8 h-8 rounded-lg bg-[#e6f4ea] flex items-center justify-center text-[#137333]">
              <Route className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <p className="text-2xl sm:text-3xl font-bold text-[#202124] font-mono">
              {totalDistanceKm} <span className="text-sm font-normal text-[#5f6368]">km</span>
            </p>
            <p className="text-xs text-[#5f6368] mt-1">
              Cumulative journey length
            </p>
          </div>
        </div>

        {/* Card 3: Longest Trip */}
        <div className="bg-white rounded-xl p-5 shadow-[0_1px_2px_0_rgba(60,64,67,0.3),0_1px_3px_1px_rgba(60,64,67,0.15)] flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#5f6368]">
              Longest Route
            </span>
            <div className="w-8 h-8 rounded-lg bg-[#fef7e0] flex items-center justify-center text-[#b06000]">
              <Award className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <p className="text-2xl sm:text-3xl font-bold text-[#202124] font-mono">
              {longestTrip ? (
                <>
                  {longestTrip.distanceKm} <span className="text-sm font-normal text-[#5f6368]">km</span>
                </>
              ) : (
                '0 km'
              )}
            </p>
            <p className="text-xs text-[#5f6368] mt-1 truncate" title={longestTrip?.name || 'No trips completed'}>
              {longestTrip?.name || 'None recorded yet'}
            </p>
          </div>
        </div>

        {/* Card 4: Top Companion */}
        <div className="bg-white rounded-xl p-5 shadow-[0_1px_2px_0_rgba(60,64,67,0.3),0_1px_3px_1px_rgba(60,64,67,0.15)] flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#5f6368]">
              Top Companion
            </span>
            {topCompanion?.profile_image ? (
              <img
                src={topCompanion.profile_image}
                alt={topCompanion.name}
                className="w-8 h-8 rounded-full border border-[#dadce0] object-cover"
              />
            ) : (
              <div className="w-8 h-8 rounded-lg bg-[#f1f3f4] flex items-center justify-center text-[#5f6368]">
                <Users className="w-4 h-4" />
              </div>
            )}
          </div>
          <div className="mt-4">
            <p className="text-2xl sm:text-3xl font-bold text-[#202124] truncate" title={topCompanion?.name || 'None'}>
              {topCompanion ? topCompanion.name : 'None'}
            </p>
            <p className="text-xs text-[#5f6368] mt-1">
              {topCompanion ? `${topCompanion.tripsTogether} trip${topCompanion.tripsTogether === 1 ? '' : 's'} together` : 'No companions yet'}
            </p>
          </div>
        </div>
      </div>

      {/* Completed Trips List Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between pl-1">
          <div className="flex items-center gap-1.5">
            <MapPin className="w-4 h-4 text-[#1a73e8]" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-[#5f6368]">
              Completed Trips ({trips.length})
            </h2>
          </div>
        </div>

        {trips.length === 0 ? (
          <div className="bg-white rounded-xl p-10 text-center text-[#5f6368] shadow-[0_1px_2px_0_rgba(60,64,67,0.3),0_1px_3px_1px_rgba(60,64,67,0.15)] space-y-3">
            <div className="w-12 h-12 rounded-full bg-[#f1f3f4] flex items-center justify-center text-[#5f6368] mx-auto">
              <Navigation className="w-6 h-6 text-[#1a73e8] transform -rotate-45" />
            </div>
            <h3 className="text-base font-bold text-[#202124]">No completed trips yet</h3>
            <p className="text-xs sm:text-sm text-[#5f6368] max-w-md mx-auto">
              Once you start and complete group routes with your travel companions, your full route history and stats will be tracked here.
            </p>
            <Link
              to="/dashboard"
              className="inline-block mt-2 px-4 py-2 rounded-full bg-[#1a73e8] hover:bg-[#1557d0] text-white font-bold text-xs transition-colors shadow-xs"
            >
              Go to Dashboard
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {trips.map((trip) => (
              <Link
                key={trip.id}
                to={`/trips/${trip.id}`}
                className="bg-white p-4 sm:p-5 rounded-xl flex items-center justify-between transition-shadow shadow-[0_1px_2px_0_rgba(60,64,67,0.3),0_1px_3px_1px_rgba(60,64,67,0.15)] hover:shadow-[0_2px_6px_2px_rgba(60,64,67,0.15),0_1px_2px_0_rgba(60,64,67,0.3)] group"
              >
                <div className="min-w-0 pr-3 flex-1 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm sm:text-base font-bold text-[#202124] group-hover:text-[#1a73e8] truncate transition-colors">
                      {trip.name}
                    </h3>
                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-[#e6f4ea] text-[#137333] border border-[#ceead6] shrink-0">
                      COMPLETED
                    </span>
                  </div>

                  <p className="text-xs sm:text-sm text-[#3c4043] font-medium flex items-center gap-1 truncate">
                    <span>{trip.origin}</span>
                    <span className="text-[#80868b]">→</span>
                    <span>{trip.destination}</span>
                  </p>

                  <div className="flex flex-wrap items-center gap-3 text-[11px] text-[#5f6368] pt-0.5">
                    {trip.group_name && (
                      <span className="flex items-center gap-1 font-medium text-[#202124]">
                        <Users className="w-3.5 h-3.5 text-[#1a73e8]" />
                        <span>{trip.group_name}</span>
                      </span>
                    )}

                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-[#80868b]" />
                      <span>
                        {new Date(trip.ended_at || trip.created_at).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        })}
                      </span>
                    </span>

                    {(trip.distance || trip.distanceKm > 0) && (
                      <span className="flex items-center gap-1 font-mono font-semibold text-[#1a73e8]">
                        <Route className="w-3.5 h-3.5" />
                        <span>{trip.distance || `${trip.distanceKm} km`}</span>
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <ChevronRight className="w-5 h-5 text-[#80868b] group-hover:text-[#1a73e8] transition-colors" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default TripHistory;
