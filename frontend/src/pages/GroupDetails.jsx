import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Users, Copy, Check, Plus, Navigation, Shield, Trash2, ArrowLeft, Radio, Calendar } from 'lucide-react';
import api from '../services/api.js';
import useAuthStore from '../store/authStore.js';
import { timeAgo } from '../utils/formatters.js';

export function GroupDetails() {
  const { groupId } = useParams();
  const { user: currentUser } = useAuthStore();
  const navigate = useNavigate();

  const [group, setGroup] = useState(null);
  const [members, setMembers] = useState([]);
  const [trips, setTrips] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  const loadGroup = async () => {
    setIsLoading(true);
    try {
      const data = await api.getGroupDetails(groupId);
      setGroup(data.group);
      setMembers(data.members || []);
      setTrips(data.trips || []);
    } catch (err) {
      setError(err.message || 'Failed to load group');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadGroup();
  }, [groupId]);

  const handleCopyCode = () => {
    if (!group?.invite_code) return;
    navigator.clipboard.writeText(group.invite_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRemoveMember = async (userId) => {
    if (!window.confirm('Are you sure you want to remove this member from the group?')) return;
    try {
      await api.removeMember(groupId, userId);
      loadGroup();
    } catch (err) {
      alert(err.message || 'Failed to remove member');
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-12 text-center text-slate-400">
        Loading group details...
      </div>
    );
  }

  if (error || !group) {
    return (
      <div className="max-w-md mx-auto px-4 py-12 text-center">
        <div className="glass-panel p-8 rounded-2xl">
          <p className="text-rose-400 text-sm mb-4">{error || 'Group not found'}</p>
          <Link to="/dashboard" className="px-4 py-2 rounded-xl bg-slate-800 text-white text-xs font-semibold">
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Navigation Header */}
      <div className="flex items-center gap-3">
        <Link
          to="/dashboard"
          className="p-2 rounded-full bg-white hover:bg-[#f1f3f4] text-[#5f6368] border border-[#dadce0] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <span className="text-xs uppercase tracking-wider text-[#5f6368] font-bold">Travel Group</span>
          <h1 className="text-xl sm:text-2xl font-bold text-[#202124]">{group.name}</h1>
        </div>
      </div>

      {/* Hero Invite Code & Info Banner */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Invite Code Box */}
        <div className="bg-white p-6 rounded-3xl border border-[#dadce0] shadow-sm flex flex-col justify-between">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-[#1a73e8] block mb-1">
              Group Invite Code
            </span>
            <p className="text-xs text-[#5f6368] mb-4">
              Share this code with friends so they can join this group from their dashboard.
            </p>
          </div>

          <div className="flex items-center justify-between p-3 rounded-2xl bg-[#f8f9fa] border border-[#dadce0]">
            <span className="font-mono text-2xl font-black tracking-widest text-[#202124]">
              {group.invite_code}
            </span>
            <button
              onClick={handleCopyCode}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#1a73e8] hover:bg-[#1557d0] text-white text-xs font-bold shadow-xs transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
        </div>

        {/* Group Stats */}
        <div className="md:col-span-2 bg-white p-6 rounded-3xl border border-[#dadce0] shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-[#5f6368] block mb-1">
                Convoy Management
              </span>
              <p className="text-sm text-[#202124] font-medium">
                You are {group.isOwner ? 'the Group Owner' : 'a Group Member'}.
              </p>
            </div>

            <Link
              to={`/trips/new?group=${group.id}`}
              className="flex items-center gap-2 px-4 py-2 rounded-full bg-[#1a73e8] hover:bg-[#1557d0] text-white font-bold text-xs shadow-sm transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Plan New Trip</span>
            </Link>
          </div>

          <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-[#f1f3f4] text-center">
            <div className="bg-[#f8f9fa] p-2.5 rounded-2xl border border-[#dadce0]">
              <span className="text-[11px] text-[#5f6368] block font-medium">Total Members</span>
              <span className="text-lg font-bold text-[#202124]">{members.length}</span>
            </div>
            <div className="bg-[#f8f9fa] p-2.5 rounded-2xl border border-[#dadce0]">
              <span className="text-[11px] text-[#5f6368] block font-medium">Planned Trips</span>
              <span className="text-lg font-bold text-[#1a73e8]">{trips.length}</span>
            </div>
            <div className="bg-[#f8f9fa] p-2.5 rounded-2xl border border-[#dadce0]">
              <span className="text-[11px] text-[#5f6368] block font-medium">Created</span>
              <span className="text-xs font-semibold text-[#202124]">{timeAgo(group.created_at)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Two Column Grid: Members & Trips */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Members List (Left 1 col) */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#5f6368]">Members ({members.length})</h3>
          </div>

          <div className="space-y-2.5">
            {members.map((mem) => (
              <div
                key={mem.id}
                className="bg-white p-3.5 rounded-2xl flex items-center justify-between border border-[#dadce0] shadow-xs"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <img
                    src={mem.profile_image || `https://api.dicebear.com/7.x/avataaars/svg?seed=${mem.name}`}
                    alt={mem.name}
                    className="w-9 h-9 rounded-full bg-[#f1f3f4] border border-[#dadce0] object-cover shrink-0"
                  />
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-[#202124] truncate">{mem.name}</p>
                    <p className="text-[10px] text-[#5f6368] truncate">{mem.email}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${
                      mem.role === 'OWNER'
                        ? 'bg-[#fef7e0] text-[#b06000] border border-[#feefc3]'
                        : 'bg-[#f1f3f4] text-[#5f6368] border border-[#dadce0]'
                    }`}
                  >
                    {mem.role}
                  </span>

                  {group.isOwner && mem.id !== currentUser?.id && (
                    <button
                      onClick={() => handleRemoveMember(mem.id)}
                      title="Remove Member"
                      className="p-1.5 rounded-full text-[#5f6368] hover:text-[#d93025] hover:bg-[#fce8e6] transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Trips List (Right 2 cols) */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#5f6368]">Group Road Trips</h3>
          </div>

          {trips.length === 0 ? (
            <div className="bg-white rounded-3xl p-8 text-center text-[#5f6368] text-xs border border-[#dadce0]">
              No trips planned for this group yet.{' '}
              <Link to={`/trips/new?group=${group.id}`} className="text-[#1a73e8] font-bold underline">
                Create one now
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {trips.map((trip) => {
                const isActive = trip.status === 'ACTIVE';
                return (
                  <div
                    key={trip.id}
                    className={`bg-white p-5 rounded-3xl border transition-all flex flex-col justify-between shadow-xs hover:shadow-sm ${
                      isActive ? 'border-[#1a73e8]' : 'border-[#dadce0]'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${
                            isActive
                              ? 'bg-[#e6f4ea] text-[#137333] border border-[#ceead6]'
                              : 'bg-[#f1f3f4] text-[#5f6368] border border-[#dadce0]'
                          }`}
                        >
                          {trip.status}
                        </span>
                        <span className="text-xs text-[#5f6368] font-mono">{trip.distance}</span>
                      </div>

                      <h4 className="text-sm font-bold text-[#202124] mb-2">{trip.name}</h4>

                      <div className="space-y-1 text-xs text-[#5f6368]">
                        <div className="flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#1e8e3e]" />
                          <span className="truncate">{trip.origin}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#d93025]" />
                          <span className="truncate">{trip.destination}</span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-5 pt-4 border-t border-[#f1f3f4] flex items-center justify-between">
                      <span className="text-[11px] text-[#5f6368]">
                        {trip.estimated_duration || 'Est. Duration N/A'}
                      </span>

                      <Link
                        to={`/trips/${trip.id}`}
                        className="px-3.5 py-1.5 rounded-full bg-[#1a73e8] hover:bg-[#1557d0] text-white font-bold text-xs shadow-xs transition-colors"
                      >
                        {isActive ? 'View Live Map' : 'Trip Details'}
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default GroupDetails;
