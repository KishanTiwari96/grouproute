import React from 'react';

export function StatusBadge({ status, speed, distance }) {
  const normalized = (status || 'MOVING').toUpperCase();

  const configs = {
    MOVING: {
      bg: 'bg-[#e6f4ea] border-[#ceead6] text-[#137333]',
      dot: 'bg-[#1e8e3e] animate-pulse',
      label: 'Moving'
    },
    STOPPED: {
      bg: 'bg-[#fce8e6] border-[#fad2cf] text-[#c5221f]',
      dot: 'bg-[#d93025]',
      label: 'Stopped'
    },
    POSSIBLE_STOP: {
      bg: 'bg-[#fef7e0] border-[#feefc3] text-[#b06000]',
      dot: 'bg-[#f9ab00] animate-ping',
      label: 'Stationary'
    },
    SPLIT: {
      bg: 'bg-[#fef7e0] border-[#feefc3] text-[#b06000]',
      dot: 'bg-[#f9ab00] animate-ping',
      label: 'Falling Behind'
    },
    REJOINED: {
      bg: 'bg-[#e8f0fe] border-[#d2e3fc] text-[#1a73e8]',
      dot: 'bg-[#1a73e8]',
      label: 'Rejoined'
    },
    LOCATION_OFF: {
      bg: 'bg-[#f1f3f4] border-[#dadce0] text-[#5f6368]',
      dot: 'bg-[#80868b]',
      label: 'Location Off'
    },
    OFFLINE: {
      bg: 'bg-[#f1f3f4] border-[#dadce0] text-[#80868b]',
      dot: 'bg-[#80868b]',
      label: 'Offline'
    },
    STALE: {
      bg: 'bg-[#fef7e0] border-[#feefc3] text-[#b06000]',
      dot: 'bg-[#f9ab00]',
      label: 'Stale GPS'
    }
  };

  const config = configs[normalized] || configs.MOVING;

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold border ${config.bg}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
      <span>{config.label}</span>
      {normalized === 'MOVING' && speed !== undefined && speed > 0 && (
        <span className="opacity-80 font-mono">· {Math.round(speed)} km/h</span>
      )}
      {normalized === 'SPLIT' && distance !== undefined && (
        <span className="opacity-90 font-mono">· {distance} km</span>
      )}
    </span>
  );
}

export default StatusBadge;
