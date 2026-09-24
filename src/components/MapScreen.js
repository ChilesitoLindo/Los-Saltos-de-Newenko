// ============================================================
// MapScreen — pantalla 02 «Mapa general del sendero».
// Copy del mockup v2 (topo andino), reorganizado por spec UX §9:
// el mapa arriba como protagonista; debajo el ribbon de datos
// esenciales, acciones (navegación + GPX), perfil real, timeline
// de estaciones y fotografías de reconocimiento (si hay fotos).
// Números desde data/trail.json y data/stations.json.
// Sin HOJA/ESC, sin sello CONAF/DAV (datos inventados).
// ============================================================
import { format } from '../utils/format.js';
import { downloadGpx } from '../utils/gpx.js';
import { elevationSvg } from './ElevationProfile.js';
import { showToast } from '../utils/toast.js';
import { elevation } from '../utils/elevation.js';

const nf = (n) => (Number.isFinite(n) ? Math.round(n).toLocaleString('es-AR') : '—');

// Íconos de diseño por etiqueta de estación (copy deck 02)
const TAG_ICONS = {
  'Agua potable': 'water_bottle',
  'Check-in QR': 'qr_code_2',
  'Coigües': 'forest',
  'Pasarela de coigüe': 'bridge',
  'Geología basáltica': 'volcano',
  'Tranco firme': 'footprint',
  'Fin de sendero': 'flag',
  'Punto panorámico': 'photo_camera'
};

export class MapScreen {
  constructor(container, options = {}) {
    this.container = container;
    this.options = options;
    this.trail = options.trail || {};
    this.stations = options.stations || [];
    this.profile = options.profile || null;
    this.gallery = Array.isArray(options.gallery) ? options.gallery : [];
  }

  mount() {
    const t = this.trail;
    const gain = Number(t.elevationGainMeters);
    const dist = Number(t.distanceMeters);
    const initial = Number(t.initialCota);
    const summit = Number(t.summitCota);

    /* ---- ribbon altimétrico + 4 métricas ---- */
    const ribbon = `
      <section class="ms-ribbon" aria-label="Resumen altimétrico">
        <div class="ms-ribbon__left">
          <span class="material-symbols-outlined" aria-hidden="true">altitude</span>
          <div>
            <span class="ms-ribbon__label">Cota altimétrica</span>
            <span class="ms-ribbon__chip">▲ ${nf(initial)} - ${nf(summit)} msnm</span>
          </div>
        </div>
        <dl class="ms-ribbon__grid">
          <div><dt>Distancia</dt><dd>${format.formatDistance(dist)}</dd></div>
          <div><dt>Desnivel</dt><dd>${Number.isFinite(gain) ? `+${gain} m` : '—'}</dd></div>
          <div><dt>Tiempo</dt><dd>${format.escapeHtml(t.estimatedDurationMinutes || '—')}</dd></div>
          <div><dt>Dificultad</dt><dd>${format.escapeHtml(t.difficulty || '—')}</dd></div>
        </dl>
      </section>`;

    /* ---- mapa (Leaflet se monta en [data-role=map] desde app.js) ---- */
    const mapStage = `
      <section class="ms-map" aria-label="Mapa del sendero">
        <div class="ms-map__viewport" data-role="map"></div>
        <div class="ms-map__legend" aria-hidden="true">
          <span class="ms-map__legend-line"></span>
          Sendero arriero
        </div>
      </section>`;

    /* ---- acciones ---- */
    const actions = `
      <div class="ms-actions">
        <button type="button" class="btn btn-primary ms-actions__btn" data-role="nav">
          <span class="material-symbols-outlined" aria-hidden="true">navigation</span>
          Iniciar navegación GPS
          <span class="material-symbols-outlined" aria-hidden="true">arrow_forward</span>
        </button>
        <button type="button" class="btn btn-secondary ms-actions__btn" data-role="gpx">
          <span class="material-symbols-outlined" aria-hidden="true">download_for_offline</span>
          Descargar recorrido GPX (offline)
        </button>
      </div>`;

    /* ---- perfil real desde data/ ---- */
    const axisLabels = this._axisLabels();
    const profileSvg = this.profile
      ? elevationSvg(this.profile, { height: 110, axisLabels, label: 'Perfil de elevación del sendero' })
      : '<p class="elevation-svg elevation-svg--empty">Perfil altimétrico no disponible.</p>';
    const profileCard = `
      <section class="ms-profile sheet" aria-label="Perfil de elevación">
        <div class="ms-profile__head">
          <p class="ms-profile__title"><span class="material-symbols-outlined" aria-hidden="true">show_chart</span> Perfil de elevación</p>
          <span class="ms-profile__range">${nf(initial)}m → ${nf(summit)}m</span>
        </div>
        ${profileSvg}
      </section>`;

    /* ---- timeline de estaciones ---- */
    const rows = this.stations.map((st, i) => {
      const chips = (st.tags || [])
        .map((tag) => `<span class="ms-tl__chip"><span class="material-symbols-outlined" aria-hidden="true">${TAG_ICONS[tag] || 'label'}</span>${format.escapeHtml(tag)}</span>`)
        .join('');
      return `
        <li class="ms-tl__row">
          <span class="ms-tl__node" aria-hidden="true">${i}</span>
          <div class="ms-tl__body">
            <div class="ms-tl__titlerow">
              <strong class="ms-tl__title">${format.escapeHtml(st.id)} · ${format.escapeHtml(st.name)}</strong>
              <span class="ms-tl__cota">${format.escapeHtml(st.cota || '')}</span>
            </div>
            <p class="ms-tl__desc">${format.escapeHtml(st.shortDescription || '')}</p>
            ${chips ? `<div class="ms-tl__chips">${chips}</div>` : ''}
          </div>
        </li>`;
    }).join('');

    const timeline = `
      <section class="ms-tl" aria-label="Estaciones del sendero">
        <div class="ms-tl__head">
          <h2 class="ms-tl__h2"><span class="material-symbols-outlined" aria-hidden="true">signpost</span> Estaciones del sendero</h2>
          <span class="ms-tl__count">${this.stations.length} hitos señalizados</span>
        </div>
        <ol class="ms-tl__list">${rows}</ol>
      </section>`;

    /* ---- fotografías de reconocimiento (si hay fotos reales) ---- */
    const gallery = this.gallery.length
      ? `
      <section class="ms-gallery" aria-label="Fotografías de reconocimiento">
        <div class="ms-gallery__head">
          <h2 class="ms-gallery__h2">Fotografías de reconocimiento</h2>
          <span class="ms-gallery__side">Campo visual</span>
        </div>
        <div class="ms-gallery__grid">
          ${this.gallery.map((g) => `
            <figure class="ms-gallery__item">
              <img src="${g.src}" alt="${format.escapeHtml(g.caption || 'Fotografía de reconocimiento del sendero')}">
              <figcaption>${format.escapeHtml(g.caption || '')}</figcaption>
            </figure>`).join('')}
        </div>
      </section>`
      : '';

    this.container.innerHTML = `
      <div class="ms">
        <main class="ms__main">
          ${this.options.intro ? `
          <div class="ms-topline">
            <button type="button" class="btn btn-ghost" data-role="map-back">
              <span class="material-symbols-outlined" aria-hidden="true">arrow_back</span>
              Volver al inicio
            </button>
          </div>` : ''}
          ${mapStage}
          ${ribbon}
          ${actions}
          ${profileCard}
          ${timeline}
          ${gallery}
        </main>
      </div>
    `;

    this._bind();
  }

  _axisLabels() {
    if (!this.stations.length) return [];
    const first = this.stations[0];
    const last = this.stations[this.stations.length - 1];
    const label = (st) => {
      const cota = elevation.parseCota(st.cota);
      return { p: Number(st.routeProgress) || 0, text: `${st.id} (${nf(cota)}m)` };
    };
    return [
      label({ ...first, routeProgress: 0 }),
      label({ ...last, routeProgress: 1 })
    ];
  }

  _bind() {
    this.container.querySelector('[data-role="nav"]').addEventListener('click', () => {
      if (this.options.onStart) this.options.onStart();
    });
    const back = this.container.querySelector('[data-role="map-back"]');
    if (back && this.options.onBack) {
      back.addEventListener('click', () => this.options.onBack());
    }
    this.container.querySelector('[data-role="gpx"]').addEventListener('click', () => {
      const res = downloadGpx({
        line: this.options.line,
        trail: this.trail,
        stations: this.stations
      });
      showToast(res.ok ? `GPX descargado: ${res.filename}` : res.message, res.ok ? 'ok' : 'error');
    });
  }
}
