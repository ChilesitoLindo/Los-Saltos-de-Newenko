// ============================================================
// ElevationProfile — SVG del perfil de elevación (compartido).
// Se usa en 00 (bienvenida), 01 (portal), 02 (mapa) y 03
// (tarjeta de progreso): un solo mecanismo de perfil.
// Datos: utils/elevation.js (modelo por tramos, sin GPS).
// ============================================================
import { escapeHtml } from '../utils/format.js';

export function elevationSvg(profile, options = {}) {
  const {
    width = 360, // ≈ ancho mobile-first: el texto queda a escala 1:1
    height = 96,
    showAxisLabels = false,
    axisLabels = [], // [{ p: 0..1, text }]
    markerProgress = null, // 0..1 · marca "estás aquí"
    label = '',
    compact = false
  } = options;

  const points = profile && Array.isArray(profile.points) ? profile.points : [];
  if (points.length < 2) {
    return `<div class="elevation-svg elevation-svg--empty">Perfil altimétrico no disponible.</div>`;
  }

  const cotas = points.map((pt) => pt.cota);
  const min = Math.min(...cotas);
  const max = Math.max(...cotas);
  const span = max - min || 1;

  const padTop = compact ? 6 : 10;
  const padBottom = showAxisLabels || axisLabels.length ? 16 : 4;

  const x = (p) => Math.max(0, Math.min(1, p)) * width;
  const y = (cota) => padTop + (1 - (cota - min) / span) * (height - padTop - padBottom);

  const line = points.map((pt, i) => `${i === 0 ? 'M' : 'L'}${x(pt.p).toFixed(1)},${y(pt.cota).toFixed(1)}`).join(' ');
  const area = `${line} L${width},${height - padBottom} L0,${height - padBottom} Z`;

  let marker = '';
  if (Number.isFinite(markerProgress)) {
    const p = Math.max(0, Math.min(1, markerProgress));
    const cota = profile.cotaAt ? profile.cotaAt(p) : null;
    if (Number.isFinite(cota)) {
      marker = `
        <line class="elevation-svg__marker-line" x1="${x(p).toFixed(1)}" y1="${padTop - 2}" x2="${x(p).toFixed(1)}" y2="${height - padBottom}" />
        <circle class="elevation-svg__marker" cx="${x(p).toFixed(1)}" cy="${y(cota).toFixed(1)}" r="4.5" />`;
    }
  }

  const labels = axisLabels.map((l) => `
    <text class="elevation-svg__label" x="${x(l.p).toFixed(1)}" y="${height - 3}" text-anchor="${l.p <= 0.02 ? 'start' : l.p >= 0.98 ? 'end' : 'middle'}">${escapeHtml(l.text)}</text>`).join('');

  const rangeText = `${Math.round(min)} a ${Math.round(max)} metros sobre el nivel del mar`;

  return `
    <svg class="elevation-svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" role="img" aria-label="${escapeHtml(label || `Perfil de elevación: ${rangeText}`)}">
      <path class="elevation-svg__area" d="${area}" />
      <path class="elevation-svg__line" d="${line}" fill="none" />
      ${marker}
      ${labels}
    </svg>`;
}

export const ElevationProfile = { elevationSvg };
