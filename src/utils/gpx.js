// ============================================================
// gpx.js — Único generador/descargador de GPX del proyecto.
// Lo usan pantalla 00 (bienvenida), 01 (portal), 02 (mapa) y
// 05 (cumbre): una sola función, sin mecanismos paralelos.
// ============================================================
import { buildProfile } from './elevation.js';

const slug = (value) =>
  String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

export function buildGpx({ line = [], trail = {}, stations = [] } = {}) {
  if (!Array.isArray(line) || line.length < 2) return null;

  const profile = buildProfile({ trail, stations, total: 0 });
  const name = trail.name || 'Sendero Newenko';

  const trackPoints = line.map((pt) => {
    const p = 0; // la geometría real aún no trae progreso por vértice
    const cota = profile.points.length ? profile.cotaAt(p) : null;
    const ele = Number.isFinite(cota) ? Math.round(cota) : 0;
    return `      <trkpt lat="${pt.lat}" lon="${pt.lon}"><ele>${ele}</ele></trkpt>`;
  }).join('\n');

  const waypoints = (Array.isArray(stations) ? stations : [])
    .filter((s) => Number.isFinite(s.latitude) && Number.isFinite(s.longitude) && !(s.latitude === 0 && s.longitude === 0))
    .map((s) => {
      const cota = profile.points.length ? profile.cotaAt(s.routeProgress || 0) : null;
      const ele = Number.isFinite(cota) ? Math.round(cota) : 0;
      return `    <wpt lat="${s.latitude}" lon="${s.longitude}"><ele>${ele}</ele><name>${escapeXml(`${s.id} - ${s.name}`)}</name></wpt>`;
    }).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Los Saltos de Newenko" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata><name>${escapeXml(name)}</name></metadata>
${waypoints}
  <trk>
    <name>${escapeXml(name)}</name>
    <trkseg>
${trackPoints}
    </trkseg>
  </trk>
</gpx>`;
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// Devuelve { ok, filename } o { ok: false, message } — nunca lanza.
export function downloadGpx({ line, trail, stations } = {}) {
  const gpx = buildGpx({ line, trail, stations });
  if (!gpx) {
    return { ok: false, message: 'La ruta del sendero no está disponible para generar el GPX.' };
  }
  try {
    const filename = `${slug(trail.gpxFile || trail.name || 'sendero-newenko')}.gpx`;
    const blob = new Blob([gpx], { type: 'application/gpx+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    return { ok: true, filename };
  } catch {
    return { ok: false, message: 'No pudimos preparar el archivo GPX. Intentá de nuevo.' };
  }
}

export const gpx = { buildGpx, downloadGpx };
