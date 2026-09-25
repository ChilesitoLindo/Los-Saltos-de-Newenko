// ============================================================
// PortalEntranceView — pantalla 01 «Portal de Entrada S0»
// (variante editorial). Copy de apertura según spec v2 §4;
// métricas = clima real (Open-Meteo vía WeatherManager, con
// último valor guardado); la radio de rescate NO va acá
// (decisión: queda fuera de las métricas).
// ============================================================
import { format } from '../utils/format.js';
import { downloadGpx } from '../utils/gpx.js';
import { elevationSvg } from './ElevationProfile.js';
import { showToast } from '../utils/toast.js';
import { elevation } from '../utils/elevation.js';

const nf = (n) => (Number.isFinite(n) ? Math.round(n).toLocaleString('es-AR') : '—');

const CONDITIONS = [
  {
    icon: 'eco',
    title: 'Bosque de Coigüe & Pellín',
    badge: 'Dosis de humus',
    text: 'Suelo cubierto de hojarasca húmeda con barandas de contención en madera rústica. Calzado con agarre requerido.'
  },
  {
    icon: 'water_bottle',
    title: 'Vertiente de Deshielo Activa',
    badge: 'Agua cristalina',
    text: 'Vertiente de recarga en S0 antes de internarte en el dosel cerrado. Flujo continuo proveniente de la alta cordillera.'
  },
  {
    icon: 'nature',
    title: 'Principio No Dejar Huella',
    badge: 'Fuego cero',
    text: 'Zona de preservación biológica. Retorno íntegro de residuos y respeto absoluto a la fauna nativa.'
  }
];

export class PortalEntranceView {
  constructor(container, options = {}) {
    this.container = container;
    this.options = options;
    this.trail = options.trail || {};
    this.stations = options.stations || [];
    this.profile = options.profile || null;
    this.weather = options.weather || null;
    // Estado de la preparación (puerta de activación, spec §5)
    this.activated = !!options.activated;
    this.checklistTotal = Number.isFinite(options.checklistTotal) ? options.checklistTotal : 0;
    this.checklistDone = Number.isFinite(options.checklistDone) ? options.checklistDone : 0;
  }

  mount() {
    const t = this.trail;
    const gain = Number(t.elevationGainMeters);
    const dist = Number(t.distanceMeters);
    const initial = Number(t.initialCota);
    const summit = Number(t.summitCota);

    // Etiquetas del perfil: cota + nombre de estación desde data/
    // (S0 inicio · primer hito de interpretación · cumbre)
    const first = this.stations[0];
    const last = this.stations[this.stations.length - 1];
    const mid = this.stations.find((s) => s.type === 'interpretation');
    const picked = [first, mid, last].filter((s, i, arr) => s && arr.indexOf(s) === i);
    const labels = picked.map((st) => ({
      cota: elevation.parseCota(st.cota),
      name: st.name
    }));

    const profileSvg = this.profile
      ? elevationSvg(this.profile, {
          height: 120,
          label: 'Gradiente y relieve de ascenso del sendero'
        })
      : '<p class="elevation-svg elevation-svg--empty">Perfil altimétrico no disponible.</p>';

    const labelHtml = labels.map((l, i) => `
      <div class="pe-profile__label ${i === 0 ? 'pe-profile__label--first' : i === labels.length - 1 ? 'pe-profile__label--last' : ''}">
        <strong>${nf(l.cota)} m</strong>
        <span>${format.escapeHtml(l.name)}</span>
      </div>`).join('');

    const conditions = CONDITIONS.map((c) => `
      <li class="pe-cond">
        <span class="pe-cond__icon" aria-hidden="true"><span class="material-symbols-outlined">${c.icon}</span></span>
        <div class="pe-cond__body">
          <span class="pe-cond__row">
            <strong>${format.escapeHtml(c.title)}</strong>
            <span class="pe-cond__badge">${format.escapeHtml(c.badge)}</span>
          </span>
          <p class="pe-cond__text">${format.escapeHtml(c.text)}</p>
        </div>
      </li>`).join('');

    const heroLayer = this.options.photo
      ? `<img class="pe-hero__img" src="${this.options.photo}" alt="Cascada de los Saltos de Newenko vista desde el portal">`
      : '';

    // Resumen de la ruta (datos esenciales, spec §5) desde data/
    // (reusa `last` declarado arriba para las etiquetas del perfil)
    const routeLabel = last ? `S0 → ${last.id} · ${last.name}` : 'S0 → S3';

    this.container.innerHTML = `
      <div class="pe">
        <div class="pe-hero" aria-hidden="true">${heroLayer}<span class="pe-hero__fade"></span></div>
        <main class="pe__main">
          <header class="pe-editorial">
            <span class="pe-editorial__kicker">Bitácora Andina</span>
            <span class="pe-editorial__title">Saltos de Newenko</span>
          </header>

          <div class="pe-tagrow">
            <span class="pe-tagrow__tag">Etapa 00 · Apertura</span>
            <span class="pe-tagrow__side">${format.escapeHtml((this.stations.find((s) => s.type === 'start') || {}).name || 'Portal de Entrada')}</span>
          </div>

          <h2 class="pe-title">La Huella del Agua Sagrada.</h2>
          <p class="pe-lede">Travesía por el cañón de robles centenarios hacia la gran caída de agua del Biobío andino. Terreno húmedo y aire mineral.</p>

          <section class="pe-passport sheet" aria-label="Datos esenciales del sendero">
            <div class="pe-passport__info">
              <span class="pe-passport__label">Pasaporte de huella</span>
              <strong class="pe-passport__route">${format.escapeHtml(routeLabel)}</strong>
            </div>
            <dl class="pe-passport__facts">
              <div class="pe-passport__fact"><dt>Distancia</dt><dd>${format.formatDistance(dist)}</dd></div>
              <div class="pe-passport__fact"><dt>Duración</dt><dd>${format.escapeHtml(t.estimatedDurationMinutes || '—')}</dd></div>
              <div class="pe-passport__fact"><dt>Desnivel</dt><dd>${Number.isFinite(gain) ? `+${gain} m` : '—'}</dd></div>
              <div class="pe-passport__fact"><dt>Dificultad</dt><dd>${format.escapeHtml(t.difficulty || '—')}</dd></div>
            </dl>
          </section>

          <section class="pe-profile sheet" aria-label="Gradiente y relieve de ascenso">
            <div class="pe-profile__head">
              <p class="pe-profile__title"><span class="material-symbols-outlined" aria-hidden="true">stacked_line_chart</span> Gradiente &amp; Relieve de Ascenso</p>
              <span class="pe-profile__gain">${Number.isFinite(gain) ? `+${gain}m D+ acumulado` : '—'}</span>
            </div>
            ${profileSvg}
            <div class="pe-profile__labels">${labelHtml}</div>
          </section>

          <section class="pe-weather" aria-label="Telemetría ambiental">
            <div class="pe-weather__card">
              <span class="pe-weather__label">Temperatura</span>
              <strong class="pe-weather__value" data-weather="temp">—</strong>
              <span class="pe-weather__sub" data-weather="temp-sub">Sin datos de clima aún</span>
            </div>
            <div class="pe-weather__card">
              <span class="pe-weather__label">Visibilidad</span>
              <strong class="pe-weather__value" data-weather="vis">—</strong>
              <span class="pe-weather__sub" data-weather="vis-sub">Sin datos de clima aún</span>
            </div>
            <div class="pe-weather__card">
              <span class="pe-weather__label">Viento</span>
              <strong class="pe-weather__value" data-weather="wind">—</strong>
              <span class="pe-weather__sub" data-weather="wind-sub">Medición a 10 m</span>
            </div>
          </section>

          <section class="pe-prep ${this.activated ? 'pe-prep--done' : ''}" aria-label="Preparación del sendero">
            <div class="pe-prep__head">
              <span class="pe-prep__icon" aria-hidden="true"><span class="material-symbols-outlined">${this.activated ? 'check_circle' : 'checklist'}</span></span>
              <div class="pe-prep__titles">
                <strong class="pe-prep__title">Preparación del sendero</strong>
                <span class="pe-prep__count" data-role="prep-count">${this.activated ? '✓ Preparación completada' : `${this.checklistDone} / ${this.checklistTotal} comprobaciones completadas`}</span>
              </div>
            </div>
            <p class="pe-prep__text">Checklist de seguridad, código del sendero y tu misión antes de arrancar.</p>
            <button type="button" class="btn btn-secondary pe-prep__btn" data-role="open-check">
              <span class="material-symbols-outlined" aria-hidden="true">checklist</span>
              Abrir preparación
            </button>
          </section>

          <div class="pe-actions">
            <button type="button" class="btn btn-primary pe-actions__btn" data-role="start">
              <span class="material-symbols-outlined" aria-hidden="true">${this.activated ? 'hiking' : 'checklist'}</span>
              <span class="pe-actions__start">
                <strong>Iniciar experiencia</strong>
                <span>${this.activated ? 'Recorré el mapa y activá la navegación GPS' : 'La preparación del sendero es el primer paso'}</span>
              </span>
              <span class="material-symbols-outlined" aria-hidden="true">arrow_forward</span>
            </button>
            <div class="pe-actions__row">
              <button type="button" class="btn btn-secondary" data-role="open-map">
                <span class="material-symbols-outlined" aria-hidden="true">map</span>
                Ver mapa
              </button>
              <button type="button" class="btn btn-secondary" data-role="gpx">
                <span class="material-symbols-outlined" aria-hidden="true">download</span>
                Descargar GPX
              </button>
            </div>
          </div>

          <button type="button" class="pe-legal-link" data-role="legal" aria-haspopup="dialog">
            <span class="material-symbols-outlined" aria-hidden="true">description</span>
            Términos de uso y aviso de privacidad
          </button>

          <section class="pe-conds" aria-label="Condiciones de marcha y entorno">
            <div class="pe-conds__head">
              <h3 class="pe-conds__title">Condiciones de Marcha &amp; Entorno</h3>
              <span class="pe-conds__side">Biobío Andino</span>
            </div>
            <ul class="pe-conds__list">${conditions}</ul>
          </section>

          <footer class="pe-foot">${format.escapeHtml(String(t.sector || '').toUpperCase())}</footer>
        </main>
      </div>
    `;

    this._bind();
    this.setWeather(this.weather);
  }

  _bind() {
    this.container.querySelector('[data-role="start"]').addEventListener('click', () => {
      if (this.options.onStart) this.options.onStart();
    });
    const openCheck = this.container.querySelector('[data-role="open-check"]');
    if (openCheck) {
      openCheck.addEventListener('click', () => {
        if (this.options.onOpenChecklist) this.options.onOpenChecklist();
      });
    }
    const openMap = this.container.querySelector('[data-role="open-map"]');
    if (openMap) {
      openMap.addEventListener('click', () => {
        if (this.options.onViewMap) this.options.onViewMap();
      });
    }
    const legal = this.container.querySelector('[data-role="legal"]');
    if (legal) {
      legal.addEventListener('click', () => {
        if (this.options.onOpenLegal) this.options.onOpenLegal();
      });
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

  setWeather(state) {
    const q = (sel) => this.container.querySelector(sel);
    const temp = q('[data-weather="temp"]');
    const tempSub = q('[data-weather="temp-sub"]');
    const vis = q('[data-weather="vis"]');
    const visSub = q('[data-weather="vis-sub"]');
    const wind = q('[data-weather="wind"]');
    if (!temp) return;

    if (!state) {
      temp.textContent = '—';
      tempSub.textContent = 'Sin datos de clima aún';
      vis.textContent = '—';
      visSub.textContent = 'Sin datos de clima aún';
      if (wind) wind.textContent = '—';
      return;
    }

    temp.textContent = format.formatTemp(state.tempC);
    const hora = format.formatClockTime(state.updatedAt);
    // Nunca presentar el dato de caché como actualizado (spec §18)
    tempSub.textContent = state.live
      ? `Actualizado ${hora}`
      : `Última actualización disponible${hora ? ` · ${hora}` : ''}`;

    vis.textContent = format.formatVisibility(state.visibilityM);
    visSub.textContent = Number.isFinite(state.visibilityM)
      ? `${(state.visibilityM / 1000).toFixed(1).replace('.', ',')} km al horizonte`
      : 'Sin datos de clima aún';

    if (wind) {
      wind.textContent = Number.isFinite(state.windKmh) ? format.formatWind(state.windKmh) : '—';
    }
  }
}
