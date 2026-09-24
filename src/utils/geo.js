const EARTH_RADIUS_M = 6371000;
const M_PER_DEG_LAT = 111320;

const toRad = (deg) => (deg * Math.PI) / 180;

export const distance = (a, b) => {
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
};

export const projectPointToSegment = (point, a, b) => {
  const midLat = (a.lat + b.lat) / 2;
  const kLat = M_PER_DEG_LAT;
  const kLon = M_PER_DEG_LAT * Math.cos(toRad(midLat));

  const ax = a.lon * kLon;
  const ay = a.lat * kLat;
  const bx = b.lon * kLon;
  const by = b.lat * kLat;
  const px = point.lon * kLon;
  const py = point.lat * kLat;

  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;

  let t = lenSq === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));

  const projX = ax + t * dx;
  const projY = ay + t * dy;

  return {
    point: { lat: projY / kLat, lon: projX / kLon },
    t,
    distance: Math.hypot(px - projX, py - projY)
  };
};

export const findNearestSegment = (point, line) => {
  if (!Array.isArray(line) || line.length < 2) return null;
  let best = null;
  for (let i = 0; i < line.length - 1; i += 1) {
    const res = projectPointToSegment(point, line[i], line[i + 1]);
    if (!best || res.distance < best.distance) {
      best = { index: i, ...res };
    }
  }
  return best;
};

export const cumulativeDistances = (line) => {
  if (!Array.isArray(line) || line.length === 0) return [0];
  const out = [0];
  for (let i = 1; i < line.length; i += 1) {
    out.push(out[i - 1] + distance(line[i - 1], line[i]));
  }
  return out;
};

export const totalDistance = (line) => {
  const cum = cumulativeDistances(line);
  return cum[cum.length - 1] || 0;
};

export const distanceAtProjection = (line, segmentIndex, t) => {
  const cum = cumulativeDistances(line);
  const segLen = distance(line[segmentIndex], line[segmentIndex + 1]);
  return cum[segmentIndex] + segLen * t;
};

export const pointAtRouteFraction = (line, fraction) => {
  if (!Array.isArray(line) || line.length === 0) return null;
  const f = Math.max(0, Math.min(1, fraction));
  const total = totalDistance(line);
  const target = total * f;
  if (line.length === 1) return { ...line[0] };

  let acc = 0;
  for (let i = 0; i < line.length - 1; i += 1) {
    const segLen = distance(line[i], line[i + 1]);
    if (acc + segLen >= target || i === line.length - 2) {
      const t = segLen === 0 ? 0 : (target - acc) / segLen;
      return {
        lat: line[i].lat + (line[i + 1].lat - line[i].lat) * t,
        lon: line[i].lon + (line[i + 1].lon - line[i].lon) * t
      };
    }
    acc += segLen;
  }
  return { ...line[line.length - 1] };
};

export const geo = {
  distance,
  projectPointToSegment,
  findNearestSegment,
  cumulativeDistances,
  totalDistance,
  distanceAtProjection,
  pointAtRouteFraction
};