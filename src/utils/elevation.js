// ============================================================
// elevation.js — Modelo altimétrico del sendero.
// Perfil por tramos entre cotas conocidas (cota base, cotas de
// estaciones desde stations.json, cota de cumbre). No usa GPS:
// es un modelo de datos puro, alimentado por data/.
// ============================================================

const parseCota = (value) => {
  if (Number.isFinite(value)) return value;
  if (typeof value !== 'string') return null;
  // "1.380 msnm" → 1380 (el punto es separador de miles)
  const digits = value.replace(/\./g, '').match(/\d+/);
  if (!digits) return null;
  return Number(digits[0]);
};

// points: [{ p: 0..1, cota }] ordenados por p, extremos garantizados
export function buildProfile({ trail = {}, stations = [], total = 0 }) {
  const initial = Number.isFinite(trail.initialCota) ? trail.initialCota : null;
  const summit = Number.isFinite(trail.summitCota) ? trail.summitCota : null;

  const raw = [];
  if (initial !== null) raw.push({ p: 0, cota: initial });
  stations.forEach((s) => {
    const cota = parseCota(s && s.cota);
    const p = Number(s && s.routeProgress);
    if (cota !== null && Number.isFinite(p)) raw.push({ p, cota });
  });
  if (summit !== null) raw.push({ p: 1, cota: summit });

  raw.sort((a, b) => a.p - b.p);

  // dedupe por p (S0 duplica el inicio; S3 duplica la cumbre)
  const points = [];
  raw.forEach((pt) => {
    const last = points[points.length - 1];
    if (last && Math.abs(last.p - pt.p) < 0.0001) {
      last.cota = pt.cota;
      return;
    }
    points.push(pt);
  });

  const cotaAt = (p) => {
    if (points.length === 0) return null;
    const frac = Math.min(1, Math.max(0, Number(p) || 0));
    if (frac <= points[0].p) return points[0].cota;
    for (let i = 1; i < points.length; i += 1) {
      if (frac <= points[i].p) {
        const a = points[i - 1];
        const b = points[i];
        const span = b.p - a.p;
        if (span <= 0) return b.cota;
        const t = (frac - a.p) / span;
        return a.cota + (b.cota - a.cota) * t;
      }
    }
    return points[points.length - 1].cota;
  };

  // Pendiente (%) entre los tramos conocidos; null si no hay modelo
  const gradeAt = (p) => {
    if (points.length < 2 || !Number.isFinite(total) || total <= 0) return null;
    const frac = Math.min(1, Math.max(0, Number(p) || 0));
    let a = points[0];
    let b = points[points.length - 1];
    for (let i = 1; i < points.length; i += 1) {
      if (frac <= points[i].p) {
        a = points[i - 1];
        b = points[i];
        break;
      }
      a = points[i];
      b = points[i + 1] || points[i];
    }
    const run = (b.p - a.p) * total;
    if (!Number.isFinite(run) || run <= 0) return null;
    return ((b.cota - a.cota) / run) * 100;
  };

  return { points, cotaAt, gradeAt, parseCota };
}

export const elevation = { buildProfile, parseCota };
