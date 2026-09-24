// ============================================================
// WeatherManager — clima en vivo vía Open-Meteo (aprobado en v2).
// - Sin clave de API, CORS abierto, compatible con hosting estático.
// - Último valor persistido en localStorage 'lastWeather': sin
//   conexión se conserva el último registrado (con su hora).
// - Sin inventar datos: si nunca hubo lectura, state = null y las
//   pantallas muestran "—" / mensaje humano.
// ============================================================
import { storage } from '../utils/storage.js';

const CACHE_MAX_AGE_MS = 45 * 60 * 1000; // re-fetch si el caché tiene >45 min
const API = 'https://api.open-meteo.com/v1/forecast';

export class WeatherManager {
  constructor(config = {}) {
    this.onUpdate = config.onUpdate || (() => {});
    const cached = storage.get('lastWeather');
    this.state = WeatherManager._normalize(cached);
    this.coords = null;
    this._inflight = false;
  }

  // coords: centro del trazado (route.geojson) — cambia con el dato real
  init(coords) {
    this.coords = coords;
    this.refresh(true);
  }

  get fresh() {
    return Boolean(
      this.state && Date.now() - (this.state.updatedAt || 0) < CACHE_MAX_AGE_MS
    );
  }

  async refresh(force = false) {
    if (this._inflight) return;
    if (!this.coords) {
      this._emit();
      return;
    }
    if (!force && this.fresh) {
      this._emit();
      return;
    }
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      this._emit(); // sirve el último valor registrado
      return;
    }

    this._inflight = true;
    try {
      const { lat, lon } = this.coords;
      const url =
        `${API}?latitude=${encodeURIComponent(lat)}&longitude=${encodeURIComponent(lon)}` +
        `&current=temperature_2m,wind_speed_10m&hourly=visibility&forecast_days=1&timezone=auto`;
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) throw new Error('http');
      const data = await res.json();
      const current = data && data.current;
      if (!current || !Number.isFinite(current.temperature_2m)) throw new Error('shape');

      let visibilityM = null;
      const hourly = data.hourly || {};
      if (Array.isArray(hourly.time) && Array.isArray(hourly.visibility)) {
        const hourKey = String(current.time || '').slice(0, 13); // "2026-09-23T01"
        const idx = hourly.time.findIndex((t) => String(t).slice(0, 13) === hourKey);
        if (idx >= 0 && Number.isFinite(hourly.visibility[idx])) {
          visibilityM = hourly.visibility[idx];
        }
      }

      this.state = {
        tempC: current.temperature_2m,
        windKmh: Number.isFinite(current.wind_speed_10m) ? current.wind_speed_10m : null,
        visibilityM,
        updatedAt: Date.now(),
        live: true
      };
      storage.set('lastWeather', {
        tempC: this.state.tempC,
        windKmh: this.state.windKmh,
        visibilityM: this.state.visibilityM,
        updatedAt: this.state.updatedAt
      });
    } catch {
      // sin red o API caída: se conserva el último registrado (state intacto)
      if (this.state) this.state.live = false;
    } finally {
      this._inflight = false;
      this._emit();
    }
  }

  _emit() {
    this.onUpdate(this.state);
  }

  static _normalize(raw) {
    if (!raw || typeof raw !== 'object') return null;
    if (!Number.isFinite(raw.tempC)) return null;
    return {
      tempC: raw.tempC,
      windKmh: Number.isFinite(raw.windKmh) ? raw.windKmh : null,
      visibilityM: Number.isFinite(raw.visibilityM) ? raw.visibilityM : null,
      updatedAt: Number.isFinite(raw.updatedAt) ? raw.updatedAt : null,
      live: false
    };
  }
}
