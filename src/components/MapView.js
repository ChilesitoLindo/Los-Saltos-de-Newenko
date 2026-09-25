import { storage } from '../utils/storage.js';
import { format } from '../utils/format.js';
import { geo } from '../utils/geo.js';

export const STATION_COLORS = {
  start: '#1e3b2f',
  interpretation: '#c98a3e',
  viewpoint: '#1e3a5f',
  rest: '#6b4f3a',
  end: '#1e3b2f'
};

export const STATION_LABELS = {
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
    this.showModeToggle = options.showModeToggle !== false;
    this.showOfflineNote = options.showOfflineNote !== false;
    this.navigationMode = options.navigationMode === true;
    this.map = null;
    this.routeLayer = null;
    this.traveledLayer = null;
    this.positionMarker = null;
    this.positionAccuracy = null;
    this.stationMarkers = [];
    this._layers = {};
    this._mode = null;
    this._toggleBtn = null;
    this._destroyed = false;
    this._note = null;
    this._onNetChange = null;
    this._baseLayers = {};
    this._basePane = null;
    this._headUp = false;
    this._heading = 0;
    this._lastPosition = null;
    this._satelliteErrorCount = 0;
    this._satelliteLoadTimer = 0;
    this._satelliteTileLoaded = false;
    this.onTileError = options.onTileError || (() => {});
  }

  init() {
    if (typeof L === 'undefined') return false;
    this.map = L.map(this.container, {
      zoomControl: true,
      attributionControl: true
    });
    this._layers.standard = L.tileLayer(TILE_STANDARD.url, TILE_STANDARD.options);
    this._layers.satellite = L.tileLayer(TILE_SATELLITE.url, TILE_SATELLITE.options);
    this._layers.satellite.on('tileerror', () => this._handleSatelliteError());
    this._layers.satellite.on('tileload', (event) => this._handleSatelliteLoad(event));
    let mode = storage.get('preferredMapMode');
    if (!['standard', 'satellite'].includes(mode)) {
      mode = 'standard';
      storage.set('preferredMapMode', mode);
    }
    this._setMode(mode);
    this.drawRoute();
    this.drawStations();
    if (this.allowMapMode && this.showModeToggle) this._mountToggle();
    if (this.showOfflineNote) this._mountOfflineNote();
    if (this.fitOnReady && this.line.length > 0) this.fitRoute();
    return true;
  }

  _createBaseLayer() {
    if (!this.map || !this.navigationMode || this._basePane) return;
    const pane = this.map.createPane('basePane');
    pane.style.zIndex = '150';
    pane.style.pointerEvents = 'none';
    if (pane.parentNode !== this.map.getContainer()) this.map.getContainer().appendChild(pane);
    this._basePane = pane;
    this._baseLayers.standard = L.tileLayer(TILE_STANDARD.url, { ...TILE_STANDARD.options, pane: 'basePane' });
    this._baseLayers.satellite = L.tileLayer(TILE_SATELLITE.url, { ...TILE_SATELLITE.options, pane: 'basePane' });
  }

  _ensureBaseLayer() {
    if (!this.map || !this.navigationMode) return;
    this._createBaseLayer();
    const layer = this._baseLayers[this._mode || 'standard'];
    if (layer && !this.map.hasLayer(layer)) layer.addTo(this.map);
  }

  _hideBaseLayer() {
    const layer = this._baseLayers[this._active];
    if (layer && this.map && this.map.hasLayer(layer)) this.map.removeLayer(layer);
  }

  _setMode(mode) {
    if (!this.map || !this._layers[mode]) return;
    if (this._layers[this._active]) this.map.removeLayer(this._layers[this._active]);
    if (this._baseLayers[this._active]) this.map.removeLayer(this._baseLayers[this._active]);
    this._mode = mode;
    this._active = mode;
    this._satelliteErrorCount = 0;
    if (mode === 'standard') {
      this._clearSatelliteLoadTimer();
      this._satelliteTileLoaded = false;
    } else {
      this._satelliteTileLoaded = false;
      this._clearSatelliteLoadTimer();
      this._satelliteLoadTimer = setTimeout(() => this._handleSatelliteError(true), 4000);
    }
    this._layers[mode].addTo(this.map);
    if (this._headUp) this._ensureBaseLayer();
    if (this._toggleBtn) this._toggleBtn.textContent = mode === 'satellite' ? 'Mapa' : 'Satélite';
  }

  getMode() {
    return this._mode || 'standard';
  }

  toggleMode() {
    this._setMode(this.getMode() === 'satellite' ? 'standard' : 'satellite');
    storage.set('preferredMapMode', this._mode);
    return this._mode;
  }

  _handleSatelliteLoad(event) {
    if (this._mode !== 'satellite') return;
    const tile = event && event.tile;
    if (!tile || tile.naturalWidth === 0) return;
    this._satelliteTileLoaded = true;
    this._clearSatelliteLoadTimer();
  }

  _clearSatelliteLoadTimer() {
    if (this._satelliteLoadTimer) clearTimeout(this._satelliteLoadTimer);
    this._satelliteLoadTimer = 0;
  }

  _handleSatelliteError(force = false) {
    if (this._mode !== 'satellite' || this._satelliteTileLoaded) return;
    this._satelliteErrorCount += 1;
    if (!force && this._satelliteErrorCount < 2) return;
    this._setMode('standard');
    storage.set('preferredMapMode', 'standard');
    this.onTileError();
  }

  _mountToggle() {
    this._toggleBtn = document.createElement('button');
    this._toggleBtn.type = 'button';
    this._toggleBtn.className = 'map-mode-toggle';
    this._toggleBtn.setAttribute('aria-pressed', String(this._mode === 'satellite'));
    this._toggleBtn.textContent = this._mode === 'satellite' ? 'Mapa' : 'Satélite';
    this._toggleBtn.addEventListener('click', () => this.toggleMode());
    if (this.container) this.container.insertBefore(this._toggleBtn, this.container.firstChild);
  }

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
    const latlngs = this.line.map((point) => [point.lat, point.lon]);
    if (this.navigationMode) {
      L.polyline(latlngs, {
        color: '#ffffff',
        weight: 9,
        opacity: 1,
        lineCap: 'round',
        lineJoin: 'round',
        interactive: false
      }).addTo(this.map);
      this.routeLayer = L.polyline(latlngs, {
        color: '#c98a3e',
        weight: 5,
        opacity: 0.95,
        lineCap: 'round',
        lineJoin: 'round'
      }).addTo(this.map);
      this.traveledLayer = L.polyline([], {
        color: '#2a4d7a',
        weight: 5,
        opacity: 0.98,
        lineCap: 'round',
        lineJoin: 'round',
        interactive: false
      }).addTo(this.map);
      return;
    }
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
    this.stationMarkers.forEach((marker) => {
      if (this.map) this.map.removeLayer(marker);
    });
    this.stationMarkers = [];
    this.stations.forEach((station) => {
      if (!this._validCoord(station)) return;
      const color = STATION_COLORS[station.type] || '#1e3a5f';
      if (this.navigationMode) {
        const label = format.escapeHtml(String(station.id || '').replace(/^S/, ''));
        const icon = L.divIcon({
          className: 'gps-map-station',
          html: `<span class="gps-map-station__ring"></span><span class="gps-map-station__core" style="--station-color:${color}">${label}</span>`,
          iconSize: [34, 34],
          iconAnchor: [17, 17]
        });
        const marker = L.marker([station.latitude, station.longitude], {
          icon,
          title: station.name || station.id || 'Estación',
          riseOnHover: true
        }).addTo(this.map);
        marker.bindTooltip(`<b>${format.escapeHtml(station.id || '')}</b> ${format.escapeHtml(station.name || '')}`, {
          direction: 'top',
          offset: [0, -15],
          className: 'gps-map-tooltip',
          opacity: 0.96
        });
        this.stationMarkers.push(marker);
        return;
      }
      const marker = L.circleMarker([station.latitude, station.longitude], {
        radius: 8,
        color: '#ffffff',
        weight: 2,
        fillColor: color,
        fillOpacity: 1
      }).bindTooltip(station.id, {
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
    if (!this.map || !position || !Number.isFinite(position.lat) || !Number.isFinite(position.lon)) return;
    this._lastPosition = position;
    if (this.positionMarker) this.map.removeLayer(this.positionMarker);
    if (this.positionAccuracy) this.map.removeLayer(this.positionAccuracy);

    const radius = Number.isFinite(position.accuracy) ? position.accuracy : 0;
    if (radius > 0) {
      this.positionAccuracy = L.circle([position.lat, position.lon], {
        radius,
        color: '#2a4d7a',
        weight: 1,
        fillColor: '#2a4d7a',
        fillOpacity: 0.12,
        interactive: false,
        className: 'gps-map-accuracy'
      }).addTo(this.map);
    }

    if (this.navigationMode) {
      const icon = L.divIcon({
        className: 'gps-map-position',
        html: '<span class="gps-map-position__halo"></span><span class="gps-map-position__cone"></span><span class="gps-map-position__dot"></span>',
        iconSize: [30, 30],
        iconAnchor: [15, 15]
      });
      this.positionMarker = L.marker([position.lat, position.lon], {
        icon,
        interactive: false,
        zIndexOffset: 1000
      }).addTo(this.map);
      this._updateHeading(position);
      return;
    }

    this.positionMarker = L.circleMarker([position.lat, position.lon], {
      radius: 8,
      color: '#ffffff',
      weight: 3,
      fillColor: '#b83a2b',
      fillOpacity: 1,
      className: 'map-beacon'
    }).addTo(this.map);
  }

  setProgress(progress) {
    if (!this.traveledLayer || !this.line || this.line.length < 2) return;
    const value = Math.max(0, Math.min(1, Number(progress) || 0));
    this.traveledLayer.setLatLngs(this._routePrefix(value));
  }

  _routePrefix(progress) {
    if (progress <= 0 || this.line.length < 2) return [];
    const cumulative = geo.cumulativeDistances(this.line);
    const total = cumulative[cumulative.length - 1] || 0;
    const target = total * progress;
    let index = 0;
    while (index < cumulative.length - 2 && cumulative[index + 1] < target) index += 1;
    const point = geo.pointAtRouteFraction(this.line, progress);
    const points = this.line.slice(0, index + 1).map((item) => [item.lat, item.lon]);
    if (point && (index >= this.line.length - 1 || cumulative[index + 1] > target)) points.push([point.lat, point.lon]);
    if (points.length < 2 && point) points.push([point.lat, point.lon]);
    return points;
  }

  centerOn(position) {
    if (!this.map || !position || !Number.isFinite(position.lat) || !Number.isFinite(position.lon)) return;
    this._lastPosition = position;
    this._headUp = false;
    this._hideBaseLayer();
    this._applyHeadingRotation();
    if (this.map.dragging) this.map.dragging.enable();
    this.map.setView([position.lat, position.lon], Math.max(this.map.getZoom(), 16), { animate: false });
  }

  get isHeadingUp() {
    return this._headUp;
  }

  fitRoute() {
    if (!this.map || !this.line || this.line.length === 0) return;
    const first = this.line[0];
    const bounds = this.line.reduce((acc, point) => acc.extend([point.lat, point.lon]), L.latLngBounds([first.lat, first.lon]));
    if (this.navigationMode) this.map.fitBounds(bounds, { paddingTopLeft: [24, 180], paddingBottomRight: [24, 190] });
    else this.map.fitBounds(bounds, { padding: [40, 40] });
  }

  toggleHeadingUp() {
    this.setHeadingUp(!this._headUp);
    return this._headUp;
  }

  setHeadingUp(enabled, heading = this._heading) {
    this._headUp = !!enabled;
    if (Number.isFinite(Number(heading))) this._heading = Number(heading);
    if (!this.map) return;
    if (this._headUp) this._ensureBaseLayer();
    else this._hideBaseLayer();
    this._applyHeadingRotation();
    if (this.map.dragging) {
      if (this._headUp) this.map.dragging.disable();
      else this.map.dragging.enable();
    }
  }

  _applyHeadingRotation() {
    if (!this.map) return;
    const mapPane = this.map.getPane('mapPane');
    if (mapPane) {
      const size = this.map.getSize();
      mapPane.style.width = `${size.x}px`;
      mapPane.style.height = `${size.y}px`;
      mapPane.style.transformOrigin = '50% 50%';
      this._rotatePane(mapPane, this._headUp ? -this._heading : 0);
    }
  }

  _rotatePane(pane, degrees) {
    if (!pane) return;
    const current = (pane.style.transform || '').replace(/\s*rotate\([^)]*\)/g, '').trim();
    pane.style.transform = degrees ? `${current} rotate(${degrees}deg)` : current;
  }

  _updateHeading(position) {
    const rawHeading = position && position.heading;
    let heading = rawHeading == null ? null : Number(rawHeading);
    if (!Number.isFinite(heading) && this.line.length > 1) {
      const nearest = geo.findNearestSegment(position, this.line);
      if (nearest) heading = geo.bearing(this.line[nearest.index], this.line[Math.min(nearest.index + 1, this.line.length - 1)]);
    }
    if (Number.isFinite(heading)) this.setHeadingUp(this._headUp, heading);
  }

  _validCoord(station) {
    return Number.isFinite(station.latitude) && Number.isFinite(station.longitude) && !(station.latitude === 0 && station.longitude === 0);
  }

  destroy() {
    this._clearSatelliteLoadTimer();
    this._destroyOfflineNote();
    if (this.map) {
      this.map.remove();
      this.map = null;
    }
    this._baseLayers = {};
    this._basePane = null;
    if (this._toggleBtn && this._toggleBtn.parentNode) this._toggleBtn.parentNode.removeChild(this._toggleBtn);
    this._toggleBtn = null;
    this._destroyed = true;
  }
}
