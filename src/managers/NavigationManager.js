import { geo } from '../utils/geo.js';

const STATUS = {
  STOPPED: 'stopped',
  NO_PERMISSION: 'no-permission',
  SEARCHING: 'searching',
  ACTIVE: 'active',
  LOW_ACCURACY: 'low-accuracy',
  OFF_ROUTE: 'off-route'
};

const DEFAULT_GPS = {
  enableHighAccuracy: true,
  timeout: 10000,
  maximumAge: 5000,
  offRouteThreshold: 25,
  offRouteConfirmationReadings: 3,
  lowAccuracyThreshold: 45
};

const STATUS_COPY = {
  stopped: '',
  searching: 'Calibrando señal satelital en el dosel...',
  active: (acc) => `En ruta · Precisión ±${Math.round(acc)}m`,
  'low-accuracy': 'Señal satelital débil bajo coigües',
  'off-route': 'Fuera de huella · Retorna al sendero',
  'no-permission': 'Activa la ubicación para seguir tu recorrido'
};

export class NavigationManager {
  constructor(config = {}) {
    const gpsConfig = { ...(config.gps || {}) };
    if (gpsConfig.offRouteThresholdMeters != null && gpsConfig.offRouteThreshold == null) {
      gpsConfig.offRouteThreshold = gpsConfig.offRouteThresholdMeters;
    }
    if (gpsConfig.offRouteReadingsConfirmation != null && gpsConfig.offRouteConfirmationReadings == null) {
      gpsConfig.offRouteConfirmationReadings = gpsConfig.offRouteReadingsConfirmation;
    }
    this.config = { ...DEFAULT_GPS, ...gpsConfig };
    this.line = config.line || [];
    this._positionHandler = config.onPosition || (() => {});
    this._statusHandler = config.onStatus || (() => {});
    this.status = STATUS.STOPPED;
    this.lastPosition = null;
    this._watchId = null;
    this._consecutiveOffRoute = 0;
  }

  onPosition(handler) {
    this._positionHandler = handler;
  }

  onStatus(handler) {
    this._statusHandler = handler;
  }

  get supported() {
    return 'geolocation' in navigator;
  }

  async start() {
    if (!this.supported) {
      this._setStatus(STATUS.NO_PERMISSION, STATUS_COPY['no-permission']);
      return;
    }
    if (this._watchId !== null) return;

    this._setStatus(STATUS.SEARCHING, STATUS_COPY.searching);
    try {
      await this._ensurePermission();
    } catch {
      this._setStatus(STATUS.NO_PERMISSION, STATUS_COPY['no-permission']);
      return;
    }

    this._watchId = navigator.geolocation.watchPosition(
      (pos) => this._onReading(pos),
      (err) => this._onError(err),
      {
        enableHighAccuracy: this.config.enableHighAccuracy,
        timeout: this.config.timeout,
        maximumAge: this.config.maximumAge
      }
    );
  }

  _ensurePermission() {
    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        () => resolve(),
        (err) => reject(err),
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
      );
    });
  }

  stop() {
    if (this._watchId !== null) {
      navigator.geolocation.clearWatch(this._watchId);
      this._watchId = null;
    }
    this._consecutiveOffRoute = 0;
    this._setStatus(STATUS.STOPPED, '');
  }

  beginSearch() {
    this._setStatus(STATUS.SEARCHING, STATUS_COPY.searching);
  }

  injectReading(position) {
    if (!position) return;
    const coords = position.coords || position;
    this._onReading({
      coords,
      timestamp: position.timestamp != null ? position.timestamp : Date.now()
    });
  }

  _onError(err) {
    if (err && err.code === err.PERMISSION_DENIED) {
      this.stop();
      this._setStatus(STATUS.NO_PERMISSION, STATUS_COPY['no-permission']);
      return;
    }
    this._setStatus(STATUS.SEARCHING, STATUS_COPY.searching);
  }

  _onReading(pos) {
    const src = pos && pos.coords && typeof pos.coords !== 'function' ? pos.coords : pos;
    const lat = typeof src.latitude === 'number' ? src.latitude : src.lat;
    const lon = typeof src.longitude === 'number' ? src.longitude : src.lon;
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
    const p = {
      lat,
      lon,
      accuracy: typeof src.accuracy === 'number' ? src.accuracy : null,
      altitude: src.altitude,
      speed: src.speed,
      heading: src.heading,
      timestamp: typeof pos.timestamp === 'number' ? pos.timestamp : Date.now()
    };
    if (!Number.isFinite(p.accuracy)) p.accuracy = null;
    this.lastPosition = p;
    this._positionHandler(p);

    if (p.accuracy !== null && p.accuracy > this.config.lowAccuracyThreshold) {
      this._setStatus(STATUS.LOW_ACCURACY, STATUS_COPY['low-accuracy'], p.accuracy);
      this._consecutiveOffRoute = 0;
      return;
    }

    const nearest = geo.findNearestSegment(p, this.line);
    if (nearest && nearest.distance > this.config.offRouteThreshold) {
      this._consecutiveOffRoute += 1;
      if (this._consecutiveOffRoute >= this.config.offRouteConfirmationReadings) {
        this._setStatus(STATUS.OFF_ROUTE, STATUS_COPY['off-route'], p.accuracy);
        return;
      }
    } else {
      this._consecutiveOffRoute = 0;
    }

    this._setStatus(
      STATUS.ACTIVE,
      p.accuracy !== null ? STATUS_COPY.active(p.accuracy) : 'En ruta',
      p.accuracy
    );
  }

  _setStatus(status, message, accuracy = null) {
    if (this.status === status && this._lastMessage === message) return;
    this.status = status;
    this._lastMessage = message;
    this._statusHandler({ status, message, accuracy });
  }
}