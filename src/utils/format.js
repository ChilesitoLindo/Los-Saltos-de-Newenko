export const escapeHtml = (value) => {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

export const formatDistance = (meters) => {
  if (!Number.isFinite(meters)) return '—';
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toLocaleString('es-AR', { maximumFractionDigits: 1 })} km`;
};

export const formatDuration = (minutes) => {
  if (!Number.isFinite(minutes) || minutes <= 0) return '—';
  const m = Math.round(minutes);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest === 0 ? `${h} h` : `${h} h ${rest} min`;
};

export const formatPercent = (fraction) => {
  if (!Number.isFinite(fraction)) return '—';
  return `${Math.round(Math.max(0, Math.min(1, fraction)) * 100)}%`;
};

export const formatCota = (meters) => {
  if (!Number.isFinite(meters)) return '—';
  return `${Math.round(meters).toLocaleString('es-AR')} msnm`;
};

/* ---- Clima (Open-Meteo: dato real, caché local en lastWeather) ---- */

export const formatTemp = (celsius) => {
  if (!Number.isFinite(celsius)) return '—';
  return `${Math.round(celsius)}°C`;
};

export const formatWind = (kmh) => {
  if (!Number.isFinite(kmh)) return '—';
  return `${Math.round(kmh)} km/h`;
};

export const formatVisibility = (meters) => {
  if (!Number.isFinite(meters)) return '—';
  if (meters >= 10000) return 'Óptima';
  if (meters >= 5000) return 'Buena';
  if (meters >= 2000) return 'Regular';
  return 'Baja';
};

export const formatClockTime = (timestamp) => {
  if (!Number.isFinite(timestamp)) return null;
  try {
    return new Date(timestamp).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return null;
  }
};

/* ---- Telemetría de marcha ---- */

export const formatEta = (meters, speedKmh = 3.5) => {
  if (!Number.isFinite(meters) || meters < 0 || !Number.isFinite(speedKmh) || speedKmh <= 0) return null;
  const minutes = (meters / 1000 / speedKmh) * 60;
  if (minutes < 1) return 'al instante';
  return `~${Math.max(1, Math.round(minutes))} min`;
};

export const formatGrade = (percent) => {
  if (!Number.isFinite(percent)) return '—';
  const rounded = Math.round(percent);
  return `${rounded >= 0 ? '+' : ''}${rounded}%`;
};

export const formatDelta = (meters) => {
  if (!Number.isFinite(meters)) return '—';
  const rounded = Math.round(meters);
  return `${rounded >= 0 ? '+' : '-'}${Math.abs(rounded)} m`;
};

export const format = {
  escapeHtml,
  formatDistance,
  formatDuration,
  formatPercent,
  formatCota,
  formatTemp,
  formatWind,
  formatVisibility,
  formatClockTime,
  formatEta,
  formatGrade,
  formatDelta
};