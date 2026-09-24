// ============================================================
// FinalizacionView — pantalla 06 «Finalización» (spec
// cumbre-finalizacion §2). El cierre de una experiencia (§14),
// no un reporte: tira de resumen en una línea, descarga GPX
// (utilidad única utils/gpx.js), guía de regreso desde
// data/safety.json y servicios desde data/trail.json.
// ============================================================
import { format } from '../utils/format.js';
import { getPassport } from '../utils/storage.js';
import { downloadGpx } from '../utils/gpx.js';
import { showToast } from '../utils/toast.js';

export class FinalizacionView {
  constructor(container, options = {}) {
    this.container = container;
    this.options = options;
    this.trail = options.trail || {};
    this.route = options.route || null;
    this.stations = options.stations || [];
    this.session = options.session || {};
    this.safety = options.safety || {};
  }

  mount() {
    const stamps = getPassport();
    const elapsedMin = Number.isFinite(this.session.elapsedMin) ? this.session.elapsedMin : null;
    const totalDistance = this.route?.totalDistance || this.trail.distanceMeters || 0;
    const total = this.stations.length;
    const stampCount = this.stations.filter((s) => stamps.includes(s.id)).length;
    const summit = Number(this.trail.summitCota);
    const gain = Number(this.trail.elevationGainMeters);

    /* ---- Tira de resumen (§14: distancia, desnivel, estaciones,
       cota máxima, tiempo — datos ya existentes, sin repetir el
       Cuaderno completo). ---- */
    const summary = `
      <section class="cv-sum" aria-label="Resumen de la expedición">
        <span class="cv-sum__kicker">Resumen de la expedición</span>
        <div class="cv-sum__item">
          <strong>${format.formatDistance(totalDistance)}</strong>
          <span>Distancia</span>
        </div>
        <div class="cv-sum__item">
          <strong>${Number.isFinite(gain) ? `+${gain} m` : '—'}</strong>
          <span>Desnivel</span>
        </div>
        <div class="cv-sum__item">
          <strong>${stampCount} / ${total}</strong>
          <span>Estaciones</span>
        </div>
        <div class="cv-sum__item">
          <strong>${format.formatCota(summit)}</strong>
          <span>Cota máxima</span>
        </div>
        <div class="cv-sum__item">
          <strong>${elapsedMin ? format.formatDuration(elapsedMin) : '—'}</strong>
          <span>Tiempo</span>
        </div>
      </section>`;

    /* ---- guía de regreso + servicios ---- */
    const guide = this.safety.returnGuide || { title: 'Guía para el regreso seguro al camping', items: [] };
    const guideItems = (guide.items || [])
      .map((item) => `
        <li class="cv-guide__item">
          <span class="material-symbols-outlined" aria-hidden="true">${format.escapeHtml(item.icon || 'signpost')}</span>
          <div>
            <strong>${format.escapeHtml(item.title)}</strong>
            <p>${format.escapeHtml(item.text)}</p>
          </div>
        </li>`)
      .join('');
    const services = (this.trail.baseServices || [])
      .map((s) => `
        <div class="cv-guide__service">
          <span class="material-symbols-outlined" aria-hidden="true">${format.escapeHtml(s.icon || 'info')}</span>
          <div>
            <strong>${format.escapeHtml(s.title)}</strong>
            <span>${format.escapeHtml(s.sub)}</span>
          </div>
        </div>`)
      .join('');

    const returnGuide = `
      <section class="cv-guide sheet" aria-label="Guía de regreso">
        <h3 class="cv-guide__title"><span class="material-symbols-outlined" aria-hidden="true">signpost</span> ${format.escapeHtml(guide.title)}</h3>
        <ul class="cv-guide__list">${guideItems}</ul>
        ${services ? `
          <h4 class="cv-guide__subtitle">Servicios disponibles en base</h4>
          <div class="cv-guide__services">${services}</div>` : ''}
      </section>`;

    this.container.innerHTML = `
      <div class="cv cv--final">
        <main class="cv__main">
          <h1 class="cv-fin__title">Cierre de la expedición</h1>

          ${summary}

          <section class="cv-gpx">
            <button type="button" class="btn btn-primary cv-gpx__btn" data-role="gpx">
              <span class="material-symbols-outlined" aria-hidden="true">download</span>
              <span class="cv-gpx__label">
                <strong>Descargar trazado GPX oficial</strong>
                <span>Organic Maps · Wikiloc · Garmin</span>
              </span>
            </button>
          </section>

          ${returnGuide}

          <div class="cv-back">
            <button type="button" class="btn btn-secondary cv-back__btn" data-role="back">
              <span class="material-symbols-outlined" aria-hidden="true">arrow_back</span>
              Volver al inicio del sendero
            </button>
          </div>

          <footer class="cv-foot">Sistema de senderos autoguiados · Newenko</footer>
        </main>
      </div>
    `;

    this.container.querySelector('[data-role="gpx"]').addEventListener('click', () => {
      const res = downloadGpx({
        line: this.route ? this.route.line : null,
        trail: this.trail,
        stations: this.stations
      });
      showToast(res.ok ? `GPX descargado: ${res.filename}` : res.message, res.ok ? 'ok' : 'error');
    });

    const back = this.container.querySelector('[data-role="back"]');
    if (back && this.options.onBack) {
      back.addEventListener('click', () => this.options.onBack());
    }
  }
}
