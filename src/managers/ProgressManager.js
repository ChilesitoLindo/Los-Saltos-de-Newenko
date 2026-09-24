import { geo } from '../utils/geo.js';

export class ProgressManager {
  constructor(config = {}) {
    this.line = config.line || [];
    this.regressionConfirmationReadings =
      config.regressionConfirmationReadings != null ? config.regressionConfirmationReadings : 3;
    this.lowAccuracyThreshold = config.lowAccuracyThreshold != null ? config.lowAccuracyThreshold : 50;
    this.total = geo.totalDistance(this.line);
    this.confirmed = 0;
    this._consecutiveRegression = 0;
    this._handler = config.onProgress || (() => {});
  }

  onProgress(handler) {
    this._handler = handler;
  }

  update(position) {
    if (!this.line || this.line.length < 2 || this.total <= 0) return;
    if (!position) return;
    if (!Number.isFinite(position.lat) || !Number.isFinite(position.lon)) return;

    if (position.accuracy > this.lowAccuracyThreshold) return;

    const nearest = geo.findNearestSegment(position, this.line);
    if (!nearest) return;

    const traveled = geo.distanceAtProjection(this.line, nearest.index, nearest.t);
    const rawProgress = Math.min(1.0, Math.max(0.0, traveled / this.total));

    // Filtro Anti-Retroceso (Estabilización): 3 lecturas consistentes para aceptar retroceso
    if (rawProgress >= this.confirmed) {
      this._accept(rawProgress);
      return;
    }

    this._consecutiveRegression += 1;
    if (this._consecutiveRegression >= this.regressionConfirmationReadings) {
      this._accept(rawProgress);
    }
  }

  _accept(fraction) {
    this._consecutiveRegression = 0;
    if (Math.abs(fraction - this.confirmed) < 0.0001) return;
    this.confirmed = fraction;
    this._handler(this.snapshot());
  }

  reset() {
    this.confirmed = 0;
    this._consecutiveRegression = 0;
    this._handler(this.snapshot());
  }

  snapshot() {
    const traveled = this.total * this.confirmed;
    return {
      progress: this.confirmed,
      progressPercentage: this.confirmed * 100,
      traveled,
      remaining: Math.max(0, this.total - traveled),
      total: this.total
    };
  }
}