const ALLOWED_KEYS = new Set([
  'trailSession',
  'lastStation',
  'lastProgress',
  'navigationStarted',
  'preferredMapMode',
  'newenko_passport',
  // Aprobadas en v2 (decisiones del usuario): lastWeather = último clima
  // leído para mostrarlo sin conexión; summitLog = libro de cumbre
  // (texto local del visitante, nunca sale del dispositivo).
  'lastWeather',
  'summitLog'
]);

const get = (key) => {
  if (!ALLOWED_KEYS.has(key)) return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const set = (key, value) => {
  if (!ALLOWED_KEYS.has(key)) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // localStorage lleno o bloqueado: la app sigue sin datos locales
  }
};

const remove = (key) => {
  if (!ALLOWED_KEYS.has(key)) return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // ignorar
  }
};

export const getPassport = () => JSON.parse(localStorage.getItem('newenko_passport') || '[]');

export const saveStamp = (stationId) => {
  const stamps = new Set(getPassport());
  stamps.add(stationId);
  localStorage.setItem('newenko_passport', JSON.stringify([...stamps]));
};

export const storage = { get, set, remove };