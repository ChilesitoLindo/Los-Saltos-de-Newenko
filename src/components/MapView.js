import { storage } from '../utils/storage.js';

export const STATION_COLORS = {
  start: '#1e3b2f',
  interpretation: '#c98a3e',
  viewpoint: '#1e3a5f',
  rest: '#6b4f3a',
  end: '#1e3b2f'
};

const STATION_LABELS = {
  start: 'Inicio',
  interpretation: 'Parada',
  viewpoint: 'Mirador',
  rest: 'Descanso',
  end: 'Fin'
};

const TILE_STANDARD = {
  url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  options: {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
  }
};

const TILE_SATELLITE = {
  url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  options: {
    maxZoom: 19,
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics, GIS User Community'
  }
};

export class MapView {
  constructor(container, options = {}) {
    this.container = container;
    this.line = options.line || [];
    this.stations = options.stations || [];
    this.fitOnReady = options.fitOnReady !== false;
    this.allowMapMode = options.allowMapMode !== false;
    this.map = null;
    this.routeLayer = null;
    this.positionMarker = null;
    this.positionAccuracy = null;
    this.stationMarkers = [];
    this._layers = {};
    this._mode = null;
    this._toggleBtn = null;
    this._destroyed = false;
    this._note = null;
    this._onNetChange = null;
  }

  init() {
    if (typeof L === 'undefined') return false;
    this.map = L.map(this.container, {
      zoomControl: true,
      attributionControl: true
    });

    this._layers.standard = L.tileLayer(TILE_STANDARD.url, TILE_STANDARD.options);
    this._layers.satellite = L.tileLayer(TILE_SATELLITE.url, TILE_SATELLITE.options);

    let mode = storage.get('preferredMapMode');
    if (!['standard', 'satellite'].includes(mode)) {
      mode = 'standard';
      storage.set('preferredMapMode', mode);
    }
    this._setMode(mode);

    this.drawRoute();
    this.drawStations();
    if (this.allowMapMode) this._mountToggle();
    this._mountOfflineNote();

    if (this.fitOnReady && this.line.length > 0) {
      this.fitRoute();
    }
    return true;
  }

  _setMode(mode) {
    if (this._layers[this._active]) this.map.removeLayer(this._layers[this._active]);
    this._mode = mode;
    this._active = mode;
    this._layers[mode].addTo(this.map);
    if (this._toggleBtn) this._toggleBtn.textContent = mode === 'satellite' ? 'Vista calle' : 'Vista satelital';
  }

  toggleMode() {
    this._setMode(this._mode === 'satellite' ? 'standard' : 'satellite');
    storage.set('preferredMapMode', this._mode);
  }

  _mountToggle() {
    this._toggleBtn = document.createElement('button');
    this._toggleBtn.type = 'button';
    this._toggleBtn.className = 'map-mode-toggle';
    this._toggleBtn.setAttribute('aria-pressed', String(this._mode === 'satellite'));
    this._toggleBtn.textContent = this._mode === 'satellite' ? 'Vista calle' : 'Vista satelital';
    this._toggleBtn.addEventListener('click', () => this.toggleMode());
    if (this.container) {
      this.container.insertBefore(this._toggleBtn, this.container.firstChild);
    }
  }

  // Contingencia offline (spec UX §19): avisa que los mosaicos
  // externos pueden faltar y que lo visible es el trazado guardado.
  _mountOfflineNote() {
    this._note = document.createElement('div');
    this._note.className = 'map-offline-note';
    this._note.setAttribute('role', 'status');
    this._onNetChange = () => {
      const offline = !navigator.onLine;
      this._note.hidden = !offline;
      this._note.textContent = offline ? 'Sin conexión · trazado guardado' : '';
    };
    window.addEventListener('online', this._onNetChange);
    window.addEventListener('offline', this._onNetChange);
    this._onNetChange();
    if (this.container) this.container.appendChild(this._note);
  }

  _destroyOfflineNote() {
    if (this._onNetChange) {
      window.removeEventListener('online', this._onNetChange);
      window.removeEventListener('offline', this._onNetChange);
      this._onNetChange = null;
    }
    if (this._note && this._note.parentNode) this._note.parentNode.removeChild(this._note);
    this._note = null;
  }

  drawRoute() {
    if (!this.line || this.line.length < 2) return;
    const latlngs = this.line.map(p => [p.lat, p.lon]);

    // Borde de contraste dibujado primero: queda detrás por orden de capas
    L.polyline(latlngs, {
      color: '#1e3b2f',
      weight: 6,
      opacity: 0.25,
      lineCap: 'round',
      lineJoin: 'round',
      interactive: false
    }).addTo(this.map);

    this.routeLayer = L.polyline(latlngs, {
      color: '#c98a3e',
      weight: 4,
      opacity: 0.95,
      lineCap: 'round',
      lineJoin: 'round'
    }).addTo(this.map);
  }

  drawStations() {
    this.stationMarkers.forEach(m => {
      if (this.map) this.map.removeLayer(m);
    });
    this.stationMarkers = [];

    this.stations.forEach(s => {
      if (!this._validCoord(s)) return;
      const color = STATION_COLORS[s.type] || '#1e3a5f';
      const marker = L.circleMarker([s.latitude, s.longitude], {
        radius: 8,
        color: '#ffffff',
        weight: 2,
        fillColor: color,
        fillOpacity: 1
      }).bindTooltip(s.id, {
        direction: 'top',
        offset: [0, -10],
        permanent: true,
        className: 'station-label',
        opacity: 1
      });
      marker.addTo(this.map);
      this.stationMarkers.push(marker);
    });
  }

  setPosition(position) {
    if (!this.map) return;
    if (!position || typeof position.lat !== 'number') return;

    if (this.positionMarker) this.map.removeLayer(this.positionMarker);
    if (this.positionAccuracy) this.map.removeLayer(this.positionAccuracy);

    const radius = Number.isFinite(position.accuracy) ? position.accuracy : 0;
    if (radius > 0) {
      this.positionAccuracy = L.circle([position.lat, position.lon], {
        radius,
        color: '#b83a2b',
        weight: 1,
        fillColor: '#b83a2b',
        fillOpacity: 0.15,
        interactive: false
      }).addTo(this.map);
    }

    // Beacon: red pulsing circle with ring
    this.positionMarker = L.circleMarker([position.lat, position.lon], {
      radius: 8,
      color: '#ffffff',
      weight: 3,
      fillColor: '#b83a2b',
      fillOpacity: 1,
      className: 'map-beacon'
    }).addTo(this.map);
  }

  centerOn(position) {
    if (!this.map || !position) return;
    if (!Number.isFinite(position.lat) || !Number.isFinite(position.lon)) return;
    this.map.setView([position.lat, position.lon], Math.max(this.map.getZoom(), 16));
  }

  fitRoute() {
    if (!this.map || !this.line || this.line.length === 0) return;
    const bounds = this.line.reduce(
      (acc, p) => acc.extend([p.lat, p.lon]),
      L.latLngBounds([])
    );
    this.map.fitBounds(bounds, { padding: [40, 40] });
  }

  _validCoord(s) {
    return Number.isFinite(s.latitude) && Number.isFinite(s.longitude) && !(s.latitude === 0 && s.longitude === 0);
  }

  destroy() {
    this._destroyOfflineNote();
    if (this.map) {
      this.map.remove();
      this.map = null;
    }
    if (this._toggleBtn && this._toggleBtn.parentNode) {
      this._toggleBtn.parentNode.removeChild(this._toggleBtn);
    }
    this._destroyed = true;
  }
}

export { STATION_LABELS };