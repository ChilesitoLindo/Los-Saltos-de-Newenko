const EMBEDDED_KEY = '__NEWENKO_EMBEDDED_DATA__';

const embeddedData = () => {
  try {
    const raw = typeof window !== 'undefined' ? window[EMBEDDED_KEY] : null;
    return raw && typeof raw === 'object' ? raw : null;
  } catch {
    return null;
  }
};

const embeddedJson = (path) => {
  const data = embeddedData();
  if (!data) return null;
  const value = Object.prototype.hasOwnProperty.call(data, path) ? data[path] : undefined;
  return value === undefined ? null : value;
};

export async function loadData(path) {
  const embedded = embeddedJson(path);
  if (embedded !== null) {
    return { ok: true, json: async () => embedded };
  }
  const res = await fetch(path);
  if (!res.ok) {
    const err = new Error('http');
    err.status = res.status;
    throw err;
  }
  return res;
}

export const loader = { loadData };