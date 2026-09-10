import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Compass, MapPin, LogOut } from 'lucide-react';
import useAuthStore from '../../store/authStore.js';
import useTripStore from '../../store/tripStore.js';

export function Navbar() {
  const { user, logout, isAuthenticated } = useAuthStore();
  const { connectionStatus, trip, offlineQueueCount } = useTripStore();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  if (!isAuthenticated) return null;

  return (
    <header className="sticky top-0 z-40 w-full bg-white shadow-[0_1px_2px_0_rgba(60,64,67,0.3),0_1px_3px_1px_rgba(60,64,67,0.15)] border-b border-[#e0e0e0]">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-14 flex items-center justify-between gap-2">
        {/* Brand Logo & Context */}
        <div className="flex items-center gap-3">
          <Link to="/dashboard" className="flex items-center gap-2 group shrink-0 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-[#1a73e8] flex items-center justify-center text-white shadow-sm font-bold group-hover:scale-105 transition-transform">
              <Compass className="w-5 h-5" />
            </div>
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="font-display text-base sm:text-lg font-bold tracking-tight text-[#202124]">
                Group<span className="text-[#1a73e8]">Route</span>
              </span>
            </div>
          </Link>

          {trip && (
            <div className="hidden md:flex items-center gap-2 pl-3 border-l border-[#e0e0e0] text-xs text-[#5f6368]">
              <MapPin className="w-3.5 h-3.5 text-[#1a73e8]" />
              <span className="font-medium truncate max-w-[200px]">{trip.name}</span>
            </div>
          )}
        </div>

        {/* Navigation & Status Pill */}
        <div className="flex items-center gap-3 sm:gap-6">
          {/* Navigation Links */}
          <nav className="hidden md:flex items-center gap-1">
            <Link
              to="/dashboard"
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                location.pathname === '/dashboard'
                  ? 'bg-[#e8f0fe] text-[#1a73e8]'
                  : 'text-[#5f6368] hover:text-[#202124] hover:bg-[#f1f3f4]'
              }`}
            >
              Dashboard
            </Link>
            <Link
              to="/settings"
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                location.pathname === '/settings'
                  ? 'bg-[#e8f0fe] text-[#1a73e8]'
                  : 'text-[#5f6368] hover:text-[#202124] hover:bg-[#f1f3f4]'
              }`}
            >
              Settings
            </Link>
          </nav>

          {/* Right User & Live Status */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Socket Connection / Offline Queue Pill */}
            <div className={`items-center gap-1.5 px-2.5 py-0.5 rounded-full border shadow-sm text-xs ${
              offlineQueueCount > 0
                ? 'flex text-[#b06000] border-[#f9ab00] bg-[#fef7e0]'
                : 'hidden sm:flex bg-white border-[#e0e0e0] text-[#5f6368]'
            }`}>
              <span
                className={`w-2 h-2 rounded-full ${
                  offlineQueueCount > 0
                    ? 'bg-[#f9ab00] animate-pulse'
                    : connectionStatus === 'connected'
                      ? 'bg-[#34a853]'
                      : 'bg-[#f9ab00] animate-pulse'
                }`}
              />
              <span className="capitalize font-mono text-[10px] text-[#3c4043] font-medium">
                {offlineQueueCount > 0
                  ? `Offline · ${offlineQueueCount} queued`
                  : connectionStatus}
              </span>
            </div>

            {/* User Profile */}
            <div className="flex items-center gap-2 pl-3 border-l border-[#e0e0e0] ml-1">
              <img
                src={user?.profile_image || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.name || 'User'}`}
                alt={user?.name}
                className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-[#f1f3f4] border border-[#dadce0] object-cover"
              />
              <div className="hidden lg:block text-left">
                <p className="text-xs font-bold text-[#202124] leading-tight truncate max-w-[120px]">{user?.name}</p>
                <p className="text-[10px] text-[#5f6368] leading-tight truncate max-w-[120px]">{user?.email}</p>
              </div>

              <button
                onClick={handleLogout}
                title="Logout"
                className="p-1.5 rounded-full text-[#5f6368] hover:text-[#d93025] hover:bg-[#fce8e6] transition-colors"
              >
                <LogOut className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

export default Navbar;
