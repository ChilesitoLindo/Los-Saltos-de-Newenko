// ============================================================
// WelcomeView — Pantalla 00 «Presentación de Newenko».
// Portada editorial (spec experiencia-ux §4): presenta Newenko
// antes de pedirle al usuario que haga algo. Sin controles
// técnicos: hero, quiénes somos, propuesta, momentos de la
// experiencia y datos del sendero. El CTA final entra a la
// pantalla operativa (01) vía showOperationalStart.
// Textos institucionales = ejemplo claramente marcado (pendiente).
// Todos los números salen de data/trail.json y data/stations.json.
// ============================================================
import { format } from '../utils/format.js';

const nf = (n) => (Number.isFinite(n) ? Math.round(n).toLocaleString('es-AR') : '—');

// Los 5 momentos de la experiencia (spec §4 "Tu experiencia")
const ETAPAS = [
  { n: '01', icon: 'explore', title: 'Conoce', text: 'Qué es Newenko y qué vas a encontrar.' },
  { n: '02', icon: 'checklist', title: 'Prepárate', text: 'Checklist, código del sendero y tu misión.' },
  { n: '03', icon: 'footprint', title: 'Camina', text: 'Mapa, perfil y GPS que te acompaña.' },
  { n: '04', icon: 'qr_code_scanner', title: 'Descubre', text: 'Escaneá los postes QR y sumá tus sellos.' },
  { n: '05', icon: 'flag', title: 'Llega a la cumbre', text: 'Mirador, pasaporte completo y regreso seguro.' }
];

// Los 3 conceptos de la propuesta (spec §4 "Nuestra propuesta")
const CONCEPTOS = [
  {
    icon: 'forest',
    title: 'Naturaleza',
    text: 'Bosque nativo de coigües y robles, vertientes y la gran cascada del sendero.'
  },
  {
    icon: 'auto_awesome',
    title: 'Experiencia',
    text: 'Un sendero interactivo: cada código QR abre una parte de la historia del lugar.'
  },
  {
    icon: 'nature_people',
    title: 'Respeto',
    text: 'Basura cero, fuego cero y silencio para la fauna nativa del bosque.'
  }
];

export class WelcomeView {
  constructor(container, options = {}) {
    this.container = container;
    this.options = options;
    this.trail = options.trail || {};
    this.stations = options.stations || [];
  }

  mount() {
    const t = this.trail;
    const dist = Number(t.distanceMeters);
    const gain = Number(t.elevationGainMeters);
    const initial = Number(t.initialCota);
    const summit = Number(t.summitCota);
    const stationCount = this.stations.length;
    const sector = format.escapeHtml(t.sector || 'Camping Loncopangue');

    const heroImg = this.options.photo
      ? `<img class="wv-hero__img" src="${this.options.photo}" alt="Panorámica del valle andino con cerros boscosos bajo cielo nublado">`
      : '';

    const conceptos = CONCEPTOS.map((c) => `
      <li class="wv-concept">
        <span class="wv-concept__icon" aria-hidden="true"><span class="material-symbols-outlined">${c.icon}</span></span>
        <div class="wv-concept__body">
          <strong class="wv-concept__title">${format.escapeHtml(c.title)}</strong>
          <p class="wv-concept__text">${format.escapeHtml(c.text)}</p>
        </div>
      </li>`).join('');

    const etapas = ETAPAS.map((e) => `
      <li class="wv-step">
        <span class="wv-step__n" aria-hidden="true">${e.n}</span>
        <span class="wv-step__icon" aria-hidden="true"><span class="material-symbols-outlined">${e.icon}</span></span>
        <div class="wv-step__body">
          <strong class="wv-step__title">${format.escapeHtml(e.title)}</strong>
          <p class="wv-step__text">${format.escapeHtml(e.text)}</p>
        </div>
      </li>`).join('');

    const datos = [
      ['Distancia', format.formatDistance(dist)],
      ['Duración', t.estimatedDurationMinutes || '—'],
      ['Dificultad', t.difficulty || '—'],
      ['Desnivel', Number.isFinite(gain) ? `+${gain} m` : '—'],
      ['Cotas', `${nf(initial)} → ${nf(summit)} msnm`],
      ['Estaciones', `${stationCount} con QR`]
    ].map(([k, v]) => `
      <div class="wv-data__row">
        <dt>${format.escapeHtml(k)}</dt>
        <dd>${format.escapeHtml(v)}</dd>
      </div>`).join('');

    this.container.innerHTML = `
      <div class="wv">
        <main class="wv__main">
          <header class="wv-hero">
            ${heroImg}
            <span class="wv-hero__shade" aria-hidden="true"></span>
            <div class="wv-hero__caption">
              <div class="wv-head__row">
                <h1 class="wv-head__title">Los Saltos de Newenko</h1>
                <img class="wv-head__isotipo" src="assets/logo/isotipo-newenko.png" alt="" aria-hidden="true">
              </div>
              <p class="wv-head__subtitle">Sendero interactivo · Camping Loncopangue</p>
              <button type="button" class="btn btn-secondary wv-hero__cta" data-role="learn">
                <span class="material-symbols-outlined" aria-hidden="true">explore</span>
                Conocer Newenko
              </button>
            </div>
          </header>

          <section class="wv-sec" id="conoce" aria-labelledby="wv-conoce-title">
            <span class="wv-sec__kicker">Quiénes somos</span>
            <h2 class="wv-sec__title" id="wv-conoce-title">Conoce Newenko</h2>
            <div class="wv-about">
              <img class="wv-about__logo" src="assets/logo/isologo-newenko.png" alt="Isologo Los Saltos de Newenko">
              <div class="wv-about__body">
                <p class="wv-about__text">Un sendero interactivo en ${sector}, pensado para recorrerlo con tu teléfono como guía.</p>
                <p class="wv-about__text">A lo largo del camino hay ${stationCount} postes con código QR: escanealos para conocer cada punto, guardá tus sellos en un pasaporte digital y seguí el mapa y el GPS aunque no haya señal.</p>
                <span class="wv-note">Texto de ejemplo · pendiente de contenido institucional</span>
              </div>
            </div>
          </section>

          <section class="wv-sec" aria-labelledby="wv-prop-title">
            <span class="wv-sec__kicker">Nuestra propuesta</span>
            <h2 class="wv-sec__title" id="wv-prop-title">Tres formas de vivir el sendero</h2>
            <ul class="wv-concepts">${conceptos}</ul>
          </section>

          <section class="wv-sec" aria-labelledby="wv-exp-title">
            <span class="wv-sec__kicker">Tu experiencia</span>
            <h2 class="wv-sec__title" id="wv-exp-title">Cinco momentos, de principio a fin</h2>
            <ol class="wv-steps">${etapas}</ol>
          </section>

          <section class="wv-sec" aria-labelledby="wv-send-title">
            <span class="wv-sec__kicker">Este sendero</span>
            <h2 class="wv-sec__title" id="wv-send-title">Newenko, en datos</h2>
            <dl class="wv-data">${datos}</dl>
          </section>

          <section class="wv-cta" aria-label="Comenzar la experiencia">
            <p class="wv-cta__line">Tu recorrido comienza aquí.</p>
            <button type="button" class="btn btn-primary wv-cta__btn" data-role="start">
              <span class="material-symbols-outlined" aria-hidden="true">hiking</span>
              Explorar el sendero
              <span class="material-symbols-outlined" aria-hidden="true">arrow_forward</span>
            </button>
            <p class="wv-cta__note">Sin cuentas ni datos personales · el GPS se procesa solo en tu teléfono</p>
          </section>
        </main>
      </div>
    `;

    this._bind();
  }

  _bind() {
    const start = this.container.querySelector('[data-role="start"]');
    if (start) {
      start.addEventListener('click', () => {
        if (this.options.onStart) this.options.onStart();
      });
    }

    const learn = this.container.querySelector('[data-role="learn"]');
    if (learn) {
      learn.addEventListener('click', () => {
        const target = this.container.querySelector('#conoce');
        if (!target) return;
        const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
      });
    }
  }
}
