// ============================================================
// SafetyChecklistView — pantalla 00-B «Preparación de
// Expedición y Reglas». Componente propio (v2 §1); el contenido
// (checklist, reglas, alerta de terreno, misión) vive en
// data/safety.json y las cotas/nombres en data/stations.json.
// ============================================================
import { format } from '../utils/format.js';
import { elevation } from '../utils/elevation.js';

const nf = (n) => (Number.isFinite(n) ? Math.round(n).toLocaleString('es-AR') : '—');

const HINT_ICONS = {
  start: 'qr_code_scanner',
  interpretation: 'eco',
  viewpoint: 'water_drop',
  end: 'flag'
};

// Ícono según el indicador de misión de la estación (data/stations.json)
const MISSION_HINT_ICONS = {
  'Registro de bitácora': 'qr_code_scanner',
  'Sello botánico nativo': 'eco',
  'Origen volcánico': 'volcano',
  'Gran Salto 30m': 'water_drop'
};

export class SafetyChecklistView {
  constructor(container, options = {}) {
    this.container = container;
    this.options = options;
    this.trail = options.trail || {};
    this.safety = options.safety || {};
    this.stations = options.stations || [];
    this._activating = false;
  }

  mount() {
    const safety = this.safety;
    const initial = Number(this.trail.initialCota);
    const s0 = this.stations.find((s) => s.type === 'start') || this.stations[0] || null;

    const subs = {
      duration: this.trail.estimatedDurationMinutes || '—',
      curfew: this.trail.returnCurfew || '—'
    };
    const fill = (text) =>
      String(text || '')
        .replace('{duration}', subs.duration)
        .replace('{curfew}', subs.curfew);

    const checklist = Array.isArray(safety.checklist) ? safety.checklist : [];
    const rules = (safety.rules && safety.rules.items) || [];
    const mission = safety.mission || {};
    const alert = safety.terrainAlert || null;

    const checklistHtml = checklist.map((item) => `
      <label class="sc-check ${this.options.activated ? 'sc-check--done' : ''}">
        <input type="checkbox" class="sc-check__box" data-check="${format.escapeHtml(item.id || '')}" ${this.options.activated ? 'checked disabled' : ''}>
        <span class="sc-check__mark" aria-hidden="true"><span class="material-symbols-outlined">check</span></span>
        <span class="sc-check__content">
          <span class="sc-check__row">
            <strong>${format.escapeHtml(fill(item.title))}</strong>
            <span class="sc-check__badge">${format.escapeHtml(fill(item.badge))}</span>
          </span>
          <span class="sc-check__desc">${format.escapeHtml(fill(item.description))}</span>
        </span>
      </label>`).join('');

    const rulesHtml = rules.map((rule, i) => `
      <li class="sc-rule">
        <span class="sc-rule__icon" aria-hidden="true"><span class="material-symbols-outlined">${format.escapeHtml(rule.icon || 'policy')}</span></span>
        <div>
          <strong class="sc-rule__title">${i + 1}. ${format.escapeHtml(rule.title)}</strong>
          <p class="sc-rule__text">${format.escapeHtml(rule.text)}</p>
        </div>
      </li>`).join('');

    const hitosHtml = this.stations.map((st) => {
      const cota = elevation.parseCota(st.cota);
      return `
        <div class="sc-hito">
          <span class="sc-hito__icon" aria-hidden="true"><span class="material-symbols-outlined">${MISSION_HINT_ICONS[st.missionHint] || HINT_ICONS[st.type] || 'eco'}</span></span>
          <div class="sc-hito__body">
            <span class="sc-hito__id">Hito ${format.escapeHtml(st.id)}</span>
            <strong class="sc-hito__cota">${nf(cota)} m</strong>
            <span class="sc-hito__name">${format.escapeHtml(st.name)}</span>
            <span class="sc-hito__hint">${format.escapeHtml(st.missionHint || '')}</span>
          </div>
        </div>`;
    }).join('');

    const photoBox = `
      <div class="sc-hero__photo ${this.options.photo ? '' : 'sc-hero__photo--noimg'}">
        ${this.options.photo ? `<img class="sc-hero__img" src="${this.options.photo}" alt="Estado actual de las pasarelas de madera del sendero">` : ''}
        <span class="sc-hero__photo-tag">Estado real</span>
        ${alert ? `
          <div class="sc-alert" role="note">
            <span class="material-symbols-outlined" aria-hidden="true">warning</span>
            <div>
              <strong class="sc-alert__tag">${format.escapeHtml(alert.tag)}</strong>
              <p class="sc-alert__text">${format.escapeHtml(alert.text)}</p>
            </div>
          </div>` : ''}
      </div>`;

    this.container.innerHTML = `
      <div class="sc">
        <main class="sc__main">
          ${this.options.onBack ? `
          <div class="sc-topline">
            <button type="button" class="btn btn-ghost" data-role="back">
              <span class="material-symbols-outlined" aria-hidden="true">arrow_back</span>
              Volver
            </button>
          </div>` : ''}

          <div class="sc-ribbon" aria-label="Telemetría de partida">
            <span class="sc-ribbon__item"><span class="material-symbols-outlined" aria-hidden="true">altitude</span> Cota base: ${format.formatCota(initial)}</span>
            <span class="sc-ribbon__item sc-ribbon__item--live"><span class="sc-ribbon__dot" aria-hidden="true"></span> Trazado abierto</span>
          </div>

          <section class="sc-hero sheet">
            <span class="sc-hero__kicker"><span class="material-symbols-outlined" aria-hidden="true">flag_circle</span> Punto de partida // ${format.escapeHtml(s0 ? `${s0.id} ${s0.name}` : 'S0')}</span>
            <h1 class="sc-hero__title">Antes de Poner el Pie en la Huella</h1>
            <p class="sc-hero__subtitle">Preparación de travesía y código de respeto a la montaña andina.</p>
            ${photoBox}
          </section>

          <section class="sc-section sheet" aria-label="Checklist del expedicionario">
            <div class="sc-section__head">
              <h2 class="sc-section__title"><span class="material-symbols-outlined" aria-hidden="true">checklist</span> Checklist del Expedicionario</h2>
              <span class="sc-counter" data-role="counter" role="status">0 / ${checklist.length} OK</span>
            </div>
            <p class="sc-section__intro">${format.escapeHtml(safety.checklistIntro || '')}</p>
            <div class="sc-checklist">${checklistHtml}</div>
            <p class="sc-warning" data-role="warning" hidden>Por favor verifica y confirma todos los puntos del checklist de seguridad antes de iniciar la marcha.</p>
          </section>

          <section class="sc-section sheet" aria-label="El código del sendero andino">
            <div class="sc-section__head">
              <h2 class="sc-section__title"><span class="material-symbols-outlined" aria-hidden="true">policy</span> El Código del Sendero Andino</h2>
            </div>
            <p class="sc-section__intro">${format.escapeHtml((safety.rules && safety.rules.subtitle) || '')}</p>
            <ul class="sc-rules">${rulesHtml}</ul>
          </section>

          <section class="sc-section sheet" aria-label="Tu misión en el sendero">
            <div class="sc-section__head">
              <h2 class="sc-section__title"><span class="material-symbols-outlined" aria-hidden="true">stars</span> ${format.escapeHtml(mission.title || 'Tu Misión en el Sendero')}</h2>
              <span class="sc-section__badge">${format.escapeHtml(mission.badge || 'Pasaporte digital')}</span>
            </div>
            <p class="sc-section__intro">${format.escapeHtml(mission.text || '')}</p>
            <div class="sc-hitos">${hitosHtml}</div>
          </section>

          <div class="sc-cta">
            ${this.options.activated ? `
            <div class="sc-cta--done" role="status">
              <span class="material-symbols-outlined" aria-hidden="true">verified</span>
              <div class="sc-cta--done__body">
                <strong>Bitácora activada</strong>
                <span>Ya completaste la preparación. Podés revisarla cuando quieras.</span>
              </div>
            </div>` : `
            <button type="button" class="btn btn-primary sc-cta__btn" data-role="activate">
              <span class="sc-cta__label" data-role="activate-label">Activar mi bitácora</span>
              <span class="material-symbols-outlined" aria-hidden="true" data-role="activate-icon">arrow_forward</span>
            </button>
            <p class="sc-cta__note">${format.escapeHtml(mission.ctaNote || '')}</p>`}
          </div>
        </main>
      </div>
    `;

    this._bind(checklist.length);
  }

  _bind(total) {
    const boxes = Array.from(this.container.querySelectorAll('[data-check]'));
    const counter = this.container.querySelector('[data-role="counter"]');
    const warning = this.container.querySelector('[data-role="warning"]');
    const btn = this.container.querySelector('[data-role="activate"]');
    const label = this.container.querySelector('[data-role="activate-label"]');
    const icon = this.container.querySelector('[data-role="activate-icon"]');
    const back = this.container.querySelector('[data-role="back"]');

    const refresh = () => {
      const checked = boxes.filter((b) => b.checked).length;
      counter.textContent = `${checked} / ${total} OK`;
      if (checked === total) warning.hidden = true;
      // El conteo alimenta el bloque "Preparación" de la pantalla 01
      if (this.options.onProgress) this.options.onProgress(checked, total);
    };

    boxes.forEach((b) => b.addEventListener('change', refresh));
    refresh();

    if (back && this.options.onBack) {
      back.addEventListener('click', () => this.options.onBack());
    }

    if (!btn) return; // modo revisión (bitácora ya activada): sin CTA de activación

    btn.addEventListener('click', () => {
      if (this._activating) return;
      const all = boxes.every((b) => b.checked);
      if (!all) {
        warning.hidden = false;
        warning.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        return;
      }
      // Confirmación local (sin red): la bitácora se activa en el dispositivo.
      this._activating = true;
      btn.disabled = true;
      label.textContent = 'Bitácora activada';
      icon.textContent = 'check_circle';
      setTimeout(() => {
        if (this.options.onActivate) this.options.onActivate();
      }, 600);
    });
  }
}
