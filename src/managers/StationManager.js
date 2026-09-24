import { loadData } from '../utils/loader.js';

export class StationManager {
  constructor(config = {}) {
    this.dataPath = config.dataPath || 'data/stations.json';
    this._stations = [];
    this.status = 'loading';
    this.message = '';
    this._handler = config.onReady || (() => {});
  }

  onReady(handler) {
    this._handler = handler;
  }

  async load() {
    try {
      const res = await loadData(this.dataPath);
      if (!res.ok) throw new Error('http');
      const data = await res.json();
      if (!Array.isArray(data) || data.length === 0) throw new Error('empty');
      this._stations = data
        .filter((s) => s && s.id)
        .sort((a, b) => (a.routeProgress || 0) - (b.routeProgress || 0));
      this.status = 'ready';
      this._handler(this._stations);
      return true;
    } catch {
      this.status = 'error';
      this.message = 'No encontramos las estaciones del sendero por ahora.';
      this._handler([]);
      return false;
    }
  }

  all() {
    return this._stations;
  }

  getById(id) {
    return this._stations.find((s) => s.id === id) || null;
  }

  resolveParam(value) {
    if (!value) return { station: null };
    const station = this.getById(value);
    if (!station) {
      return { station: null, error: 'No encontramos esta estación.' };
    }
    return { station, error: null };
  }

  nextStation(progress) {
    if (this._stations.length === 0) return null;
    return this._stations.find((s) => (s.routeProgress || 0) > progress + 0.0001) || null;
  }
}