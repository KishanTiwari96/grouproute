import React, { useEffect } from 'react';
import { AlertTriangle, MapPin, CheckCircle2, X, ArrowRight } from 'lucide-react';
import useTripStore from '../../store/tripStore.js';

export function AlertBanner() {
  const { activeAlert, clearActiveAlert, focusMember, focusStop, focusLocation, stops } = useTripStore();

  useEffect(() => {
    if (activeAlert) {
      const timer = setTimeout(() => {
        clearActiveAlert();
      }, 10000);
      return () => clearTimeout(timer);
    }
  }, [activeAlert, clearActiveAlert]);

  if (!activeAlert) return null;

  const typeStyles = {
    warning: 'bg-white border-[#feefc3] text-[#202124] shadow-xl',
    danger: 'bg-white border-[#fad2cf] text-[#202124] shadow-xl',
    info: 'bg-white border-[#d2e3fc] text-[#202124] shadow-xl',
    success: 'bg-white border-[#ceead6] text-[#202124] shadow-xl'
  };

  const icons = {
    warning: <AlertTriangle className="w-5 h-5 text-[#f9ab00] shrink-0" />,
    danger: <AlertTriangle className="w-5 h-5 text-[#d93025] shrink-0 animate-pulse" />,
    info: <MapPin className="w-5 h-5 text-[#1a73e8] shrink-0" />,
    success: <CheckCircle2 className="w-5 h-5 text-[#1e8e3e] shrink-0" />
  };

  const iconBg = {
    warning: 'bg-[#fef7e0]',
    danger: 'bg-[#fce8e6]',
    info: 'bg-[#e8f0fe]',
    success: 'bg-[#e6f4ea]'
  };

  const style = typeStyles[activeAlert.type] || typeStyles.info;
  const icon = icons[activeAlert.type] || icons.info;
  const currentIconBg = iconBg[activeAlert.type] || 'bg-[#e8f0fe]';

  const handleAction = () => {
    if (activeAlert.targetUserId) {
      focusMember(activeAlert.targetUserId);
    } else if (activeAlert.targetStopId) {
      const target = stops.find(s => s.id === activeAlert.targetStopId);
      if (target) {
        focusStop(target);
      }
    } else if (activeAlert.locationCoords) {
      focusLocation(activeAlert.locationCoords.lat, activeAlert.locationCoords.lng);
    }
  };

  return (
    <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50 max-w-lg w-full px-4 animate-in fade-in slide-in-from-top-4 duration-300 pointer-events-auto">
      <div className={`p-3.5 sm:p-4 rounded-2xl border shadow-xl flex items-center justify-between gap-3.5 ${style}`}>
        <div className="flex items-center gap-3 min-w-0">
          <div className={`p-2 rounded-xl shrink-0 ${currentIconBg}`}>
            {icon}
          </div>
          <div className="min-w-0">
            {activeAlert.title && (
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#5f6368] block">
                {activeAlert.title}
              </span>
            )}
            <p className="text-xs sm:text-sm font-bold text-[#202124] leading-snug truncate">
              {activeAlert.message}
            </p>
            {(activeAlert.nearbyPetrol || activeAlert.nearbyHotel) && (
              <div className="flex items-center gap-2 mt-1 text-[11px] font-medium text-[#5f6368]">
                {activeAlert.nearbyPetrol && (
                  <span className="flex items-center gap-0.5 text-[#202124] bg-[#f1f3f4] px-1.5 py-0.2 rounded-md">
                    <span>⛽</span>
                    <span>{activeAlert.nearbyPetrol.name} ({activeAlert.nearbyPetrol.distanceText})</span>
                  </span>
                )}
                {activeAlert.nearbyHotel && (
                  <span className="flex items-center gap-0.5 text-[#202124] bg-[#f1f3f4] px-1.5 py-0.2 rounded-md">
                    <span>🏨</span>
                    <span>{activeAlert.nearbyHotel.name} ({activeAlert.nearbyHotel.distanceText})</span>
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {activeAlert.actionLabel && (
            <button
              onClick={handleAction}
              className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-[#1a73e8] hover:bg-[#1557d0] text-white font-bold text-xs shadow-sm transition-all"
            >
              <span>{activeAlert.actionLabel}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            onClick={clearActiveAlert}
            className="p-1.5 rounded-full text-[#5f6368] hover:text-[#202124] hover:bg-[#f1f3f4] transition-colors"
            title="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default AlertBanner;
