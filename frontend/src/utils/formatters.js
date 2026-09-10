export function formatDistance(km) {
  if (km === undefined || km === null || isNaN(km)) return '0 km';
  if (km < 1) {
    return `${Math.round(km * 1000)} m`;
  }
  return `${Number(km).toFixed(1)} km`;
}

export function formatSpeed(kmh) {
  if (kmh === undefined || kmh === null || isNaN(kmh)) return '0 km/h';
  return `${Math.round(kmh)} km/h`;
}

export function formatDuration(seconds) {
  if (!seconds || seconds <= 0) return '0 min';
  const totalMinutes = Math.round(seconds / 60);
  if (totalMinutes < 60) {
    return `${totalMinutes} min${totalMinutes === 1 ? '' : 's'}`;
  }
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  return `${hours}h ${mins}m`;
}

export function formatTime(isoStringOrTimestamp) {
  if (!isoStringOrTimestamp) return '';
  const date = new Date(isoStringOrTimestamp);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function timeAgo(isoStringOrTimestamp) {
  if (!isoStringOrTimestamp) return '';
  const date = new Date(isoStringOrTimestamp);
  const now = new Date();
  const seconds = Math.floor((now - date) / 1000);

  if (seconds < 10) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}
