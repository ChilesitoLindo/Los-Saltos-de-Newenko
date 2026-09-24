import { geo } from '../utils/geo.js';
import { loadData } from '../utils/loader.js';

const coordsToLatLng = (coords) => ({
  lat: coords[1],
  lon: coords[0]
});

export class RouteManager {
  constructor(config = {}) {
    this.dataPath = config.dataPath || 'data/route.geojson';
    this.status = 'loading';
    this.message = '';
    this.geojson = null;
    this.line = [];
    this.name = '';
    this.description = '';
    this.totalDistance = 0;
    this._statusHandler = config.onStatus || (() => {});
  }

  onStatus(handler) {
    this._statusHandler = handler;
  }

  async load() {
    this._emit('loading', '');
    try {
      const res = await loadData(this.dataPath);
      if (!res.ok) throw new Error('http');
      this.geojson = await res.json();
      const feature = this._pickLineString(this.geojson);
      if (!feature) throw new Error('no-line');

      this.name = (feature.properties && feature.properties.name) || '';
      this.description = (feature.properties && feature.properties.description) || '';
      this.line = feature.geometry.coordinates.map(coordsToLatLng);
      if (this.line.length < 2) throw new Error('short-line');

      this.totalDistance = geo.totalDistance(this.line);
      this.status = 'ready';
      this._emit('ready', '');
      return true;
    } catch {
      this.status = 'error';
      this.message = 'La ruta del sendero no está disponible por ahora.';
      this._emit('error', this.message);
      return false;
    }
  }

  _pickLineString(geojson) {
    if (!geojson || geojson.type !== 'FeatureCollection' || !Array.isArray(geojson.features)) {
      return null;
    }
    return geojson.features.find((f) => f && f.geometry && f.geometry.type === 'LineString') || null;
  }

  _emit(status, message) {
    this._statusHandler({ status, message });
  }
}