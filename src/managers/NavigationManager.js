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
  active: (accuracy) => `En ruta · Precisión ±${Math.round(accuracy)}m`,
  'low-accuracy': 'Señal satelital débil bajo coigües',
  'off-route': 'Fuera de huella · Retorna al sendero',
  'no-permission': 'Activa la ubicación para seguir tu recorrido'
};

export class NavigationManager {
  constructor(config = {}) {
    const gpsConfig = { ...(config.gps || {}) };
    if (gpsConfig.offRouteThresholdMeters != null && gpsConfig.offRouteThreshold == null) gpsConfig.offRouteThreshold = gpsConfig.offRouteThresholdMeters;
    if (gpsConfig.offRouteReadingsConfirmation != null && gpsConfig.offRouteConfirmationReadings == null) gpsConfig.offRouteConfirmationReadings = gpsConfig.offRouteReadingsConfirmation;
    this.config = { ...DEFAULT_GPS, ...gpsConfig };
    this.line = config.line || [];
    this._positionHandler = config.onPosition || (() => {});
    this._statusHandler = config.onStatus || (() => {});
    this.status = STATUS.STOPPED;
    this.lastPosition = null;
    this._watchId = null;
    this._consecutiveOffRoute = 0;
    this._lastMessage = '';
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
      (position) => this._onReading(position),
      (error) => this._onError(error),
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
        (error) => reject(error),
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

  acknowledgeOffRoute() {
    this._consecutiveOffRoute = 0;
    if (this._watchId === null && !this.lastPosition) {
      this._setStatus(STATUS.SEARCHING, STATUS_COPY.searching);
      return;
    }
    const accuracy = this.lastPosition && Number.isFinite(this.lastPosition.accuracy) ? this.lastPosition.accuracy : null;
    this._setStatus(STATUS.ACTIVE, accuracy === null ? 'En ruta' : STATUS_COPY.active(accuracy), accuracy);
  }

  injectReading(position) {
    if (!position) return;
    const coords = position.coords || position;
    this._onReading({
      coords,
      timestamp: position.timestamp != null ? position.timestamp : Date.now()
    });
  }

  _onError(error) {
    if (error && error.code === error.PERMISSION_DENIED) {
      this.stop();
      this._setStatus(STATUS.NO_PERMISSION, STATUS_COPY['no-permission']);
      return;
    }
    this._setStatus(STATUS.SEARCHING, STATUS_COPY.searching);
  }

  _onReading(position) {
    const source = position && position.coords && typeof position.coords !== 'function' ? position.coords : position;
    const lat = typeof source.latitude === 'number' ? source.latitude : source.lat;
    const lon = typeof source.longitude === 'number' ? source.longitude : source.lon;
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
    const reading = {
      lat,
      lon,
      accuracy: typeof source.accuracy === 'number' ? source.accuracy : null,
      altitude: source.altitude,
      speed: source.speed,
      heading: source.heading,
      timestamp: typeof position.timestamp === 'number' ? position.timestamp : Date.now()
    };
    if (!Number.isFinite(reading.accuracy)) reading.accuracy = null;
    this.lastPosition = reading;
    this._positionHandler(reading);

    if (reading.accuracy !== null && reading.accuracy > this.config.lowAccuracyThreshold) {
      this._setStatus(STATUS.LOW_ACCURACY, STATUS_COPY['low-accuracy'], reading.accuracy);
      this._consecutiveOffRoute = 0;
      return;
    }

    const nearest = geo.findNearestSegment(reading, this.line);
    if (nearest && nearest.distance > this.config.offRouteThreshold) {
      this._consecutiveOffRoute += 1;
      if (this._consecutiveOffRoute >= this.config.offRouteConfirmationReadings) {
        this._consecutiveOffRoute = 0;
        this._setStatus(STATUS.OFF_ROUTE, STATUS_COPY['off-route'], reading.accuracy);
        return;
      }
    } else {
      this._consecutiveOffRoute = 0;
    }

    this._setStatus(
      STATUS.ACTIVE,
      reading.accuracy !== null ? STATUS_COPY.active(reading.accuracy) : 'En ruta',
      reading.accuracy
    );
  }

  _setStatus(status, message, accuracy = null) {
    if (this.status === status && this._lastMessage === message) return;
    this.status = status;
    this._lastMessage = message;
    this._statusHandler({ status, message, accuracy });
  }
}
