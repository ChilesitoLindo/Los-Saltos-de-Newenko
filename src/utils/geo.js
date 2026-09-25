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

export const bearing = (a, b) => {
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const dLon = toRad(b.lon - a.lon);
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
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
    const result = projectPointToSegment(point, line[i], line[i + 1]);
    if (!best || result.distance < best.distance) best = { index: i, ...result };
  }
  return best;
};

export const cumulativeDistances = (line) => {
  if (!Array.isArray(line) || line.length === 0) return [0];
  const result = [0];
  for (let i = 1; i < line.length; i += 1) result[i] = result[i - 1] + distance(line[i - 1], line[i]);
  return result;
};

export const totalDistance = (line) => {
  const cumulative = cumulativeDistances(line);
  return cumulative[cumulative.length - 1] || 0;
};

export const distanceAtProjection = (line, segmentIndex, t) => {
  const cumulative = cumulativeDistances(line);
  const segmentLength = distance(line[segmentIndex], line[segmentIndex + 1]);
  return cumulative[segmentIndex] + segmentLength * t;
};

export const pointAtRouteFraction = (line, fraction) => {
  if (!Array.isArray(line) || line.length === 0) return null;
  const value = Math.max(0, Math.min(1, fraction));
  const total = totalDistance(line);
  const target = total * value;
  if (line.length === 1) return { ...line[0] };
  let accumulated = 0;
  for (let i = 0; i < line.length - 1; i += 1) {
    const segmentLength = distance(line[i], line[i + 1]);
    if (accumulated + segmentLength >= target || i === line.length - 2) {
      const t = segmentLength === 0 ? 0 : (target - accumulated) / segmentLength;
      return {
        lat: line[i].lat + (line[i + 1].lat - line[i].lat) * t,
        lon: line[i].lon + (line[i + 1].lon - line[i].lon) * t
      };
    }
    accumulated += segmentLength;
  }
  return { ...line[line.length - 1] };
};

export const geo = {
  distance,
  bearing,
  projectPointToSegment,
  findNearestSegment,
  cumulativeDistances,
  totalDistance,
  distanceAtProjection,
  pointAtRouteFraction
};
