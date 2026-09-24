// ============================================================
// CumbreView — pantalla 05 «Cumbre» (spec cumbre-finalizacion §2).
// El resultado de todo el recorrido: ribbon de cota, héroe de
// culminación y Cuaderno de Terreno (métricas + hitos + acta).
// La descarga GPX, la guía de regreso y los servicios viven en
// FinalizacionView — un solo mecanismo, sin duplicar (§2).
// ============================================================
import { format } from '../utils/format.js';
import { getPassport } from '../utils/storage.js';

const nf = (n) => (Number.isFinite(n) ? Math.round(n).toLocaleString('es-AR') : '—');

export class CumbreView {
  constructor(container, options = {}) {
    this.container = container;
    this.options = options;
    this.trail = options.trail || {};
    this.stations = options.stations || [];
    this.session = options.session || {};
  }

  mount() {
    const stamps = getPassport();
    const elapsedMin = Number.isFinite(this.session.elapsedMin) ? this.session.elapsedMin : null;
    const totalDistance = this.trail.distanceMeters || 0;
    const total = this.stations.length;
    const stampCount = this.stations.filter((s) => stamps.includes(s.id)).length;
    const summit = Number(this.trail.summitCota);
    const gain = Number(this.trail.elevationGainMeters);
    const last = this.stations[this.stations.length - 1] || null;
    const fecha = new Date().toLocaleDateString('es-CL');

    /* ---- Cuaderno de Terreno ---- */
    const metrics = `
      <div class="cv-nb__grid">
        <div class="cv-nb__metric">
          <span class="material-symbols-outlined" aria-hidden="true">straighten</span>
          <div>
            <span class="cv-nb__metric-label">Distancia total</span>
            <strong>${format.formatDistance(totalDistance)}</strong>
            <span class="cv-nb__metric-sub">Recorrido total</span>
          </div>
        </div>
        <div class="cv-nb__metric">
          <span class="material-symbols-outlined" aria-hidden="true">trending_up</span>
          <div>
            <span class="cv-nb__metric-label">Desnivel superado</span>
            <strong>${Number.isFinite(gain) ? `+${gain} m` : '—'}</strong>
            <span class="cv-nb__metric-sub">Subida acumulada</span>
          </div>
        </div>
        <div class="cv-nb__metric">
          <span class="material-symbols-outlined" aria-hidden="true">pin_drop</span>
          <div>
            <span class="cv-nb__metric-label">Estaciones</span>
            <strong>${stampCount} / ${total}</strong>
            <span class="cv-nb__metric-sub">${this.stations.map((s) => s.id).join(', ')}</span>
          </div>
        </div>
        <div class="cv-nb__metric">
          <span class="material-symbols-outlined" aria-hidden="true">mountain_flag</span>
          <div>
            <span class="cv-nb__metric-label">Cota máxima</span>
            <strong>${format.formatCota(summit)}</strong>
            <span class="cv-nb__metric-sub">${last ? format.escapeHtml(`${last.id} · ${last.name}`) : '—'}</span>
          </div>
        </div>
      </div>`;

    const timeStrip = `
      <div class="cv-nb__time">
        <span class="material-symbols-outlined" aria-hidden="true">timer</span>
        <div>
          <span class="cv-nb__time-label">Tiempo invertido</span>
          <strong>${elapsedMin ? format.formatDuration(elapsedMin) : '—'}</strong>
        </div>
        <span class="cv-nb__time-sub">desde la activación de la bitácora</span>
      </div>`;

    const hitos = this.stations.map((s) => {
      const on = stamps.includes(s.id);
      return `
        <div class="cv-nb__row ${on ? 'cv-nb__row--on' : ''}">
          <span class="material-symbols-outlined" aria-hidden="true">${on ? 'check_circle' : 'lock'}</span>
          <strong>${format.escapeHtml(s.id)}</strong>
          <span class="cv-nb__row-name">${format.escapeHtml(s.name)}</span>
          <span class="cv-nb__row-cota">${format.escapeHtml(s.cota || '')}</span>
        </div>`;
    }).join('');

    const thumb = this.options.photo
      ? `
        <figure class="cv-nb__thumb">
          <img src="${this.options.photo}" alt="Mirador del Salto Newenko visto desde la plataforma">
          <figcaption class="cv-nb__thumb-cap">
            <span class="cv-nb__thumb-kicker">Punto cúlmine</span>
            <strong>Salto Mayor Newenko</strong>
            <span class="cv-nb__thumb-badge">Hito ${last ? format.escapeHtml(last.id) : 'S3'} mirador</span>
          </figcaption>
        </figure>`
      : '';

    const notebook = `
      <article class="cv-nb" aria-label="Cuaderno de terreno">
        <header class="cv-nb__head">
          <span class="cv-nb__head-title"><span class="material-symbols-outlined" aria-hidden="true">menu_book</span> Cuaderno de Terreno — Los Saltos de Newenko</span>
          <span class="cv-nb__head-acta">Acta ${stampCount}/${total}</span>
        </header>
        ${thumb}
        ${metrics}
        ${timeStrip}
        <div class="cv-nb__rows-title">Hitos registrados en libreta</div>
        ${hitos}
      </article>`;

    this.container.innerHTML = `
      <div class="cv">
        <main class="cv__main">
          <section class="cv-ribbon" aria-label="Estado final">
            <span class="cv-ribbon__label"><span class="material-symbols-outlined" aria-hidden="true">altitude</span> Cota registro</span>
            <strong class="cv-ribbon__cota">▲ ${nf(summit)} msnm</strong>
            <span class="cv-ribbon__status">Expedición finalizada</span>
          </section>

          <section class="cv-hero sheet" aria-label="Culminación">
            <span class="cv-hero__badge">Sello de culminación</span>
            <h1 class="cv-hero__title">¡Travesía completada con éxito!</h1>
            <p class="cv-hero__sub">Recorrido integral por el bosque templado lluvioso y la gran caída de agua.</p>
            <div class="cv-hero__stamp">
              <span class="material-symbols-outlined" aria-hidden="true">verified</span>
              <div>
                <strong>Sello andino verificado</strong>
                <span>Fecha: ${format.escapeHtml(fecha)}</span>
              </div>
            </div>
          </section>

          ${notebook}

          <section class="cv-cta">
            <button type="button" class="btn btn-primary cv-cta__btn" data-role="finalize">
              Finalizar recorrido
              <span class="material-symbols-outlined" aria-hidden="true">arrow_forward</span>
            </button>
          </section>
        </main>
      </div>
    `;

    this.container.querySelector('[data-role="finalize"]').addEventListener('click', () => {
      if (this.options.onFinalize) this.options.onFinalize();
    });
  }
}
