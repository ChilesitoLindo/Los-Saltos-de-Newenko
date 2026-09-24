import { geo } from '../utils/geo.js';

const M_PER_DEG_LAT = 111320;
const OFF_ROUTE_METERS = 45;

export class DemoController {
  constructor(app) {
    this.app = app;
    this.container = null;
    this._timers = [];
    this._running = false;
    this._seqBtn = null;
  }

  mount(container) {
    this.container = container;
    this.container.innerHTML = `
      <div class="demo-bar" role="group" aria-label="Controles de demostración">
        <button type="button" class="ctl" data-role="seq">▶ Recorrer secuencia completa</button>
        <button type="button" class="ctl" data-role="adv">Simular avance +10%</button>
      </div>
    `;
    this._seqBtn = this.container.querySelector('[data-role="seq"]');
    this._seqBtn.addEventListener('click', () => this.runSequence());
    this.container.querySelector('[data-role="adv"]').addEventListener('click', () => this.stepProgress());
  }

  _clearTimers() {
    this._timers.forEach((t) => clearTimeout(t));
    this._timers = [];
  }

  _after(ms, fn) {
    this._timers.push(setTimeout(fn, ms));
  }

  _inject(fraction, accuracy) {
    const app = this.app;
    if (!app.route || !app.route.line || !app.nav) return;
    const base = geo.pointAtRouteFraction(app.route.line, Math.max(0, Math.min(1, fraction)));
    if (!base) return;
    app.nav.injectReading({ ...base, accuracy, timestamp: Date.now() });
  }

  _offRoutePoint(fraction) {
    const line = this.app.route && this.app.route.line;
    if (!Array.isArray(line) || line.length < 2) return null;
    const base = geo.pointAtRouteFraction(line, Math.max(0, Math.min(1, fraction)));
    if (!base) return null;
    const near = geo.findNearestSegment(base, line);
    if (!near) return null;
    const a = line[near.index];
    const b = line[near.index + 1];
    const kLon = M_PER_DEG_LAT * Math.cos((base.lat * Math.PI) / 180);
    const dx = (b.lon - a.lon) * kLon;
    const dy = (b.lat - a.lat) * M_PER_DEG_LAT;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    const threshold = (this.app.nav && this.app.nav.config && this.app.nav.config.offRouteThreshold) || 25;
    let meters = OFF_ROUTE_METERS;
    let candidate = null;
    for (let i = 0; i < 6; i += 1) {
      candidate = {
        lat: base.lat + (ny * meters) / M_PER_DEG_LAT,
        lon: base.lon + (nx * meters) / kLon
      };
      const check = geo.findNearestSegment(candidate, line);
      if (check && check.distance > threshold * 1.3) break;
      meters += 25;
    }
    return candidate;
  }

  _injectOffRoute(fraction) {
    const app = this.app;
    const point = this._offRoutePoint(fraction);
    if (!point || !app.nav) return;
    app.nav.injectReading({ lat: point.lat, lon: point.lon, accuracy: 8, timestamp: Date.now() });
  }

  runSequence() {
    this._clearTimers();
    if (this._running) {
      this._running = false;
      this._seqBtn.textContent = '▶ Recorrer secuencia completa';
      return;
    }
    const app = this.app;
    const frac = app.progress ? app.progress.confirmed : 0;
    this._running = true;
    this._seqBtn.textContent = '■ Detener secuencia';

    app.nav.beginSearch();
    this._after(800, () => this._inject(frac, 8));
    this._after(1700, () => this._inject(frac, 80));
    this._after(2600, () => this._injectOffRoute(frac));
    this._after(2680, () => this._injectOffRoute(frac));
    this._after(2760, () => this._injectOffRoute(frac));
    this._after(14000, () => {
      this._inject(frac, 8);
      this._running = false;
      this._seqBtn.textContent = '▶ Recorrer secuencia completa';
    });
  }

  stepProgress() {
    const app = this.app;
    if (!app.progress || !app.route || !app.route.line || !app.nav) return;
    const target = Math.min(1, app.progress.confirmed + 0.1);
    const base = geo.pointAtRouteFraction(app.route.line, target);
    app.nav.injectReading({ ...base, accuracy: 8, timestamp: Date.now() });
  }

  destroy() {
    this._clearTimers();
    this.container = null;
  }
}