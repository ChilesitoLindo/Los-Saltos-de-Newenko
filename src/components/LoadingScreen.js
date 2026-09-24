import { format } from '../utils/format.js';

/* Pantalla de carga — Base de datos/index.html (OpenDesign).
   Anillo topográfico giratorio sobre el isotipo, gauge S0·Portal → S3·Mirador,
   status rotativo con beacon y tira de estaciones S0–S3.
   Se monta al inicio del boot() y se retira con fade cuando la app terminó de
   inicializar (duración mínima del mockup + init completo, ver spec). */

const STATUSES = [
  'Sincronizando carta topográfica',
  'Calibrando altímetro · {cota}',
  'Georreferenciando la huella',
  'Mapa del sendero listo · 100%'
];

// Fallback = literales del mockup; trail.json los reemplaza en setData().
const FALLBACK_COTA = '1.295 msnm';
const FALLBACK_DIST = '1.250';

export class LoadingScreen {
  constructor() {
    this._reduced = Boolean(
      window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    );
    this._duration = this._reduced ? 1400 : 3200;
    this._fadeMs = this._reduced ? 120 : 340;
    this._el = null;
    this._raf = 0;
    this._ended = false;
    this._finished = false;
    this._onEnd = null;
    this._cota = FALLBACK_COTA;
    this._dist = FALLBACK_DIST;
    this._statuses = this._buildStatuses();
  }

  _buildStatuses() {
    return STATUSES.map((s) => s.replace('{cota}', this._cota));
  }

  start() {
    if (this._el) return this;

    const el = document.createElement('section');
    el.className = 'ls-screen';
    el.setAttribute('aria-labelledby', 'ls-title');
    el.innerHTML = `
      <div class="ls-rig" aria-hidden="true">
        <div class="ls-ring ls-ring--outer">
          <svg class="ls-ring-svg" viewBox="0 0 220 220" xmlns="http://www.w3.org/2000/svg">
            <g fill="none" stroke="var(--border-topo)" stroke-width="1">
              <circle cx="110" cy="110" r="104" stroke-dasharray="3 7" stroke-opacity="0.9"/>
              <circle cx="110" cy="110" r="96" stroke-dasharray="5 9" stroke-opacity="0.7"/>
              <circle cx="110" cy="110" r="88" stroke-dasharray="8 4" stroke-opacity="0.5"/>
            </g>
            <g stroke="var(--cordillera-blue)" stroke-opacity="0.5" stroke-width="0.8">
              <line x1="110" y1="4" x2="110" y2="16"/>
              <line x1="110" y1="204" x2="110" y2="216"/>
              <line x1="4" y1="110" x2="16" y2="110"/>
              <line x1="204" y1="110" x2="216" y2="110"/>
            </g>
          </svg>
        </div>
        <div class="ls-ring ls-ring--inner">
          <svg class="ls-ring-svg" viewBox="0 0 220 220" xmlns="http://www.w3.org/2000/svg">
            <g fill="none" stroke="var(--ls-tick-blue)" stroke-width="1">
              <circle cx="110" cy="110" r="80" stroke-dasharray="2 6" stroke-opacity="0.75"/>
            </g>
            <g stroke="var(--ls-tick-blue)" stroke-width="1.4" stroke-opacity="0.9">
              <line x1="190" y1="110" x2="176" y2="110"/>
              <line x1="110" y1="30" x2="110" y2="44"/>
              <line x1="30" y1="110" x2="44" y2="110"/>
              <line x1="110" y1="190" x2="110" y2="176"/>
            </g>
          </svg>
        </div>
        <div class="ls-ring ls-ring--dots">
          <svg class="ls-ring-svg" viewBox="0 0 220 220" xmlns="http://www.w3.org/2000/svg">
            <circle cx="110" cy="110" r="82" fill="none" stroke="var(--amber-track)" stroke-opacity="0.35" stroke-width="1"/>
            <circle cx="192" cy="110" r="4" fill="var(--amber-track)"/>
            <circle cx="28" cy="110" r="4" fill="var(--forest-primary)"/>
            <circle cx="110" cy="192" r="4" fill="var(--amber-track)"/>
            <circle cx="110" cy="28" r="3" fill="var(--forest-primary)"/>
          </svg>
        </div>
        <div class="ls-capsule">
          <img src="assets/logo/isotipo-newenko.png" alt="">
        </div>
      </div>

      <div class="ls-stack">
        <h1 id="ls-title" class="ls-title">Los Saltos de Newenko</h1>
        <p class="ls-sub mono">Sendero Interactivo · Camping Loncopangue</p>

        <div class="ls-gauge" aria-hidden="true">
          <div class="ls-gauge-track"><div class="ls-gauge-fill" data-role="fill"></div></div>
        </div>
        <div class="ls-gauge-labels mono" aria-hidden="true">
          <span>S0 · Portal</span>
          <span data-role="pct">0%</span>
          <span>S3 · Mirador</span>
        </div>

        <div class="ls-status-wrap" role="status" aria-live="polite">
          <span class="ls-beacon" aria-hidden="true"></span>
          <span class="ls-status mono" data-role="status">${format.escapeHtml(this._statuses[0])}</span>
        </div>

        <div class="ls-strip" aria-hidden="true">
          <span class="ls-tick">S0</span>
          <span class="ls-tick">S1</span>
          <span class="ls-tick">S2</span>
          <span class="ls-tick">S3</span>
        </div>
      </div>

      <div class="ls-foot mono" aria-hidden="true">
        <span>WGS84</span><span class="ls-sep">·</span><span><span data-role="dist">${this._dist}</span> m de huella</span>
      </div>
    `;
    document.body.appendChild(el);
    this._el = el;
    this._run();
    return this;
  }

  // Datos reales del sendero (trail.json) para cota y distancia del loader.
  setData(trail) {
    if (!trail) return;
    const cota = Number(trail.initialCota);
    const dist = Number(trail.distanceMeters);
    if (Number.isFinite(cota)) this._cota = format.formatCota(cota);
    if (Number.isFinite(dist)) this._dist = Math.round(dist).toLocaleString('es-AR');
    this._statuses = this._buildStatuses();
    if (!this._el) return;
    const distEl = this._el.querySelector('[data-role="dist"]');
    if (distEl) distEl.textContent = this._dist;
  }

  _run() {
    const fill = this._el.querySelector('[data-role="fill"]');
    const pct = this._el.querySelector('[data-role="pct"]');
    const status = this._el.querySelector('[data-role="status"]');
    this._ticks = Array.from(this._el.querySelectorAll('.ls-tick'));
    const start = performance.now();

    const step = (now) => {
      if (!this._el) return;
      const t = Math.min(1, (now - start) / this._duration);
      const eased = t === 1 ? 1 : 1 - Math.pow(1 - t, 3);
      const val = Math.round(eased * 100);
      fill.style.width = `${val}%`;
      pct.textContent = `${val}%`;
      status.textContent = this._statuses[Math.min(this._statuses.length - 1, Math.floor(t * this._statuses.length))];
      this._setTicks(val);
      if (t < 1) {
        this._raf = requestAnimationFrame(step);
      } else {
        this._ended = true;
        if (this._onEnd) this._onEnd();
      }
    };
    this._raf = requestAnimationFrame(step);
  }

  // Marcado de la tira S0–S3 (misma regla del prototipo).
  _setTicks(pctVal) {
    this._ticks.forEach((tick, i) => {
      tick.classList.toggle('ls-is-done', pctVal >= 100);
      tick.classList.toggle(
        'ls-is-current',
        pctVal >= (i + 1) * 25 && pctVal < (i === 3 ? 100 : (i + 2) * 25)
      );
    });
  }

  _waitEnd() {
    if (this._ended) return Promise.resolve();
    return new Promise((resolve) => { this._onEnd = resolve; });
  }

  // Duración mínima del mockup + init completo; luego fade de salida.
  async finish() {
    if (this._finished) return;
    this._finished = true;
    await this._waitEnd();
    if (!this._el) return;
    this._el.classList.add('is-leaving');
    await new Promise((resolve) => setTimeout(resolve, this._fadeMs));
    this.destroy();
  }

  destroy() {
    if (this._raf) cancelAnimationFrame(this._raf);
    this._raf = 0;
    if (this._el) {
      this._el.remove();
      this._el = null;
    }
  }
}
