// ============================================================
// StationOverlay — fichas 04 / 04-B «Estación QR & Pasaporte».
// Diseño nuevo (paquete v2): banner de desbloqueo/sello + celdas
// de pasaporte, héroe con datos derivados del recorrido, métricas,
// misiones/observaciones por estación (data/stations.json),
// protocolo de seguridad, trivia (spec v2 §1: "trivias … y
// timbrado") y Libro de Cumbre en S3 (local: summitLog).
// Sin DAV, sin IDs inventados, sin coordenadas hasta dato real.
// ============================================================
import { format } from '../utils/format.js';
import { getPassport, saveStamp, storage } from '../utils/storage.js';
import { elevation } from '../utils/elevation.js';

const nf = (n) => (Number.isFinite(n) ? Math.round(n).toLocaleString('es-AR') : '—');

const OBSERVE_ICONS = {
  flora: 'eco',
  geologia: 'diamond',
  hidrografia: 'water_drop',
  fauna: 'pets',
  default: 'visibility'
};

export class StationOverlay {
  constructor(container, options = {}) {
    this.container = container;
    this.options = options;
    this.station = null;
    this.ctx = {};
    this.challengeAnswered = false;
    this.weather = null;
  }

  open(station, detectedByQr = false, context = {}) {
    this.station = station;
    this.ctx = context || {};
    this.weather = this.ctx.weather || null;
    this.challengeAnswered = false;
    this._render(detectedByQr);
    this.container.classList.add('station-overlay--open');
    document.body.classList.add('is-overlayed');
    this.setWeather(this.weather);
  }

  close() {
    this.container.classList.remove('station-overlay--open');
    document.body.classList.remove('is-overlayed');
    this.container.innerHTML = '';
    if (this.options.onClose) this.options.onClose();
  }

  _render(detectedByQr) {
    const st = this.station;
    const ctx = this.ctx;
    const trail = ctx.trail || {};
    const stamps = getPassport();
    const hasStamp = stamps.includes(st.id);
    const challenge = st.challenge || {};
    const observeItems = st.whatToObserve || [];
    const observeBlocks = st.observeBlocks || [];
    const sections = st.sections || [];
    const all = Array.isArray(ctx.all) && ctx.all.length ? ctx.all : [st];

    const cotaNum = elevation.parseCota(st.cota);
    const initialCota = Number(trail.initialCota);
    const delta = Number.isFinite(cotaNum) && Number.isFinite(initialCota) ? cotaNum - initialCota : null;
    const progress = Number.isFinite(ctx.progress) ? ctx.progress : 0;
    const total = all.length;

    /* ---- datos derivados del recorrido (sin inventar) ---- */
    const session = storage.get('trailSession') || {};
    const marchMin = session.startedAt
      ? Math.max(0, Math.round((Date.now() - session.startedAt) / 60000))
      : null;
    const traveledM = (Number(trail.distanceMeters) || 0) * progress;

    /* ---- banner: desbloqueo QR o sello + pasaporte ---- */
    const cells = all
      .map((s) => `<span class="so-banner__cell ${stamps.includes(s.id) ? 'so-banner__cell--on' : ''}">${stamps.includes(s.id) ? '●' : '○'} ${format.escapeHtml(s.id)}</span>`)
      .join('');

    const banner = `
      <section class="so-banner ${detectedByQr ? 'so-banner--qr' : ''}">
        ${detectedByQr ? `
          <span class="so-banner__unlock">
            <span class="material-symbols-outlined" aria-hidden="true">qr_code_scanner</span>
            Hito desbloqueado vía QR físico
          </span>` : `
          <span class="so-banner__kicker">
            <span class="material-symbols-outlined" aria-hidden="true">verified</span>
            Sello andino timbrado #${String(ctx.index != null && ctx.index >= 0 ? ctx.index : 0).padStart(2, '0')} / ${String(total).padStart(2, '0')}
          </span>`}
        <div class="so-banner__row">
          <div class="so-banner__info">
            ${detectedByQr ? '' : `<h2 class="so-banner__name">${format.escapeHtml(st.name)}</h2>`}
            <p class="so-banner__progress-label">Progreso del pasaporte de cordillera:</p>
            <div class="so-banner__cells">${cells}</div>
          </div>
          ${detectedByQr ? '' : `
            <div class="so-banner__stamp" aria-hidden="true">
              <span class="so-banner__stamp-brand">Newenko</span>
              <span class="material-symbols-outlined">done_all</span>
              <strong>${nf(cotaNum)}m</strong>
            </div>`}
        </div>
      </section>`;

    /* ---- héroe fotográfico (foto real si existe; si no, degradado) ---- */
    const heroChips = (st.heroChips || [])
      .map((chip) => `<span class="so-hero__chip so-hero__chip--soft">${format.escapeHtml(chip)}</span>`)
      .join('');

    const hero = `
      <article class="so-hero ${st.image ? '' : 'so-hero--noimg'}">
        ${st.image ? `<img class="so-hero__img" src="${st.image}" alt="${format.escapeHtml(st.heroTitle || st.name)}">` : ''}
        <div class="so-hero__shade" aria-hidden="true"></div>
        <div class="so-hero__chips">
          ${Number.isFinite(cotaNum) ? `<span class="so-hero__chip"><span class="material-symbols-outlined" aria-hidden="true">pin_drop</span> ${format.formatCota(cotaNum)}${Number.isFinite(delta) && delta !== 0 ? ` (+${nf(delta)}m)` : ''}</span>` : ''}
          ${heroChips}
        </div>
        <div class="so-hero__caption">
          ${st.heroKicker ? `<span class="so-hero__kicker">${format.escapeHtml(st.heroKicker)}</span>` : ''}
          <h3 class="so-hero__title">${format.escapeHtml(st.heroTitle || `${st.id} · ${st.name}`)}</h3>
          ${st.heroSubtitle ? `<p class="so-hero__subtitle"><span class="material-symbols-outlined" aria-hidden="true">landscape</span> ${format.escapeHtml(st.heroSubtitle)}</p>` : ''}
          <div class="so-hero__datarow">
            ${marchMin !== null ? `<span><span class="material-symbols-outlined" aria-hidden="true">schedule</span> ${marchMin} min de marcha</span>` : ''}
            <span><span class="material-symbols-outlined" aria-hidden="true">straighten</span> ${nf(traveledM)} m recorridos</span>
            <span><span class="material-symbols-outlined" aria-hidden="true">device_thermostat</span> <strong data-weather="temp">—</strong></span>
          </div>
        </div>
      </article>`;

    /* ---- franja de métricas (solo si la estación define fluidMetric, ej. S3) ---- */
    const gain = Number(trail.elevationGainMeters);
    const metrics = st.fluidMetric ? `
      <div class="so-metrics">
        <div class="so-metric">
          <span class="so-metric__label">Desnivel total</span>
          <strong class="so-metric__value">${Number.isFinite(gain) ? `+${gain} m` : '—'}</strong>
          <span class="so-metric__sub">Completado ${format.formatPercent(progress)}</span>
        </div>
        <div class="so-metric">
          <span class="so-metric__label">${format.escapeHtml(st.fluidMetric.label)}</span>
          <strong class="so-metric__value">${format.escapeHtml(st.fluidMetric.value)}</strong>
          <span class="so-metric__sub">${format.escapeHtml(st.fluidMetric.sub)}</span>
        </div>
        <div class="so-metric">
          <span class="so-metric__label">Cota altimétrica</span>
          <strong class="so-metric__value">${nf(cotaNum)} m</strong>
          <span class="so-metric__sub">${st.type === 'viewpoint' ? 'Hito cumbre' : 'Expedición activa'}</span>
        </div>
      </div>` : '';

    /* ---- qué observar / misión de observación ---- */
    let observeHtml = '';
    if (observeBlocks.length > 0) {
      const items = observeBlocks.map((b) => `
        <li class="so-observe__item">
          <span class="so-observe__icon" aria-hidden="true"><span class="material-symbols-outlined">${format.escapeHtml(b.icon || 'visibility')}</span></span>
          <div class="so-observe__body">
            <span class="so-observe__row">
              <strong>${format.escapeHtml(b.title)}</strong>
              <span class="so-observe__badge">${format.escapeHtml(b.badge || '')}</span>
            </span>
            <p>${format.escapeHtml(b.text)}</p>
          </div>
        </li>`).join('');
      observeHtml = `
        <section class="so-section" aria-label="Observación">
          <div class="so-section__head">
            <h4 class="so-section__title"><span class="material-symbols-outlined" aria-hidden="true">visibility</span> ${format.escapeHtml(st.observeHeading || 'Qué observar en este punto')}</h4>
            ${st.observeBadge ? `<span class="so-section__badge">${format.escapeHtml(st.observeBadge)}</span>` : ''}
          </div>
          <ul class="so-observe">${items}</ul>
        </section>`;
    } else if (observeItems.length > 0) {
      observeHtml = `
        <section class="so-section" aria-label="Qué observar en este punto">
          <div class="so-section__head">
            <h4 class="so-section__title"><span class="material-symbols-outlined" aria-hidden="true">visibility</span> ${format.escapeHtml(st.observeHeading || 'Qué observar en este punto')}</h4>
            ${st.observeBadge ? `<span class="so-section__badge">${format.escapeHtml(st.observeBadge)}</span>` : ''}
          </div>
          <ul class="so-observe so-observe--plain">
            ${observeItems.map((item) => `
              <li class="so-observe__item">
                <span class="so-observe__icon" aria-hidden="true"><span class="material-symbols-outlined">${OBSERVE_ICONS.default}</span></span>
                <div class="so-observe__body"><p>${format.escapeHtml(item)}</p></div>
              </li>`).join('')}
          </ul>
        </section>`;
    }

    /* ---- secciones editoriales (texto y delta) ---- */
    const sectionsHtml = sections.map((sec) => {
      if (sec.kind === 'delta') {
        const d = Number.isFinite(delta) ? delta : 0;
        const pisos = Math.max(1, Math.round(Math.abs(d) / 3));
        const text = String(sec.text || '')
          .replace('{delta}', `${nf(d)}m`)
          .replace('{pisos}', `${pisos} pisos de edificio`);
        return `
          <section class="so-delta sheet" aria-label="${format.escapeHtml(sec.title)}">
            <div class="so-delta__box">
              <strong>${d >= 0 ? '+' : ''}${nf(d)}m</strong>
              <span>Delta</span>
            </div>
            <div class="so-delta__body">
              <h4>${format.escapeHtml(sec.title)}</h4>
              <p>${format.escapeHtml(text)}</p>
            </div>
          </section>`;
      }
      return `
        <section class="so-section" aria-label="${format.escapeHtml(sec.title)}">
          <h4 class="so-section__title so-section__title--solo"><span class="material-symbols-outlined" aria-hidden="true">history_edu</span> ${format.escapeHtml(sec.title)}</h4>
          <p class="so-section__text">${format.escapeHtml(sec.text)}</p>
        </section>`;
    }).join('');

    /* ---- trivia (spec v2 §1: trivias + timbrado) ---- */
    const challengeHtml = challenge.question ? `
      <section class="station-overlay__challenge" data-challenge>
        <h3 class="station-overlay__challenge-title">
          <span class="material-symbols-outlined">quiz</span>
          Desafío de la Estación
        </h3>
        <p class="station-overlay__challenge-question">${format.escapeHtml(challenge.question)}</p>
        <div class="station-overlay__options" role="radiogroup" aria-label="Opciones de respuesta">
          ${challenge.options.map((opt, idx) => `
            <button type="button" class="station-overlay__option ${hasStamp ? 'station-overlay__option--answered' : ''}" data-option="${idx}" ${hasStamp ? 'disabled' : ''} role="radio" aria-checked="false">
              <span class="station-overlay__option-label">${format.escapeHtml(opt)}</span>
              <span class="station-overlay__option-radio" aria-hidden="true"></span>
            </button>`).join('')}
        </div>
        <div class="station-overlay__stamp-earned ${hasStamp ? 'station-overlay__stamp-earned--animate' : ''}" ${hasStamp ? '' : 'hidden'}>
          <span class="material-symbols-outlined">verified</span>
          <span data-role="stamp-text">${hasStamp ? `¡Sello obtenido: ${format.escapeHtml(challenge.badge)}!` : ''}</span>
        </div>
      </section>` : '';

    /* ---- protocolo de seguridad ---- */
    const safetyHtml = st.safetyNote ? `
      <div class="so-safety" role="note">
        <span class="material-symbols-outlined" aria-hidden="true">warning</span>
        <div class="so-safety__body">
          <span class="so-safety__row">
            <strong>Protocolo de seguridad</strong>
            <span class="so-safety__badge">${format.escapeHtml(st.safetyBadge || 'Zona expuesta')}</span>
          </span>
          <p>${format.escapeHtml(st.safetyNote)}</p>
        </div>
      </div>` : '';

    /* ---- libro de cumbre (solo estaciones con summitLog: S3) ---- */
    const savedLog = storage.get('summitLog');
    const logForMe = savedLog && savedLog.stationId === st.id ? savedLog : null;
    const logHtml = st.summitLog ? `
      <section class="so-log sheet" aria-label="Libro de cumbre">
        <div class="so-log__head">
          <span class="so-log__label">Libro de Cumbre ${format.escapeHtml(st.id)} · Bitácora de paso</span>
          <span class="so-log__time">Hora Chile: ${format.formatClockTime(Date.now())}</span>
        </div>
        <div class="so-log__row">
          <input type="text" class="so-log__input" data-role="log-input" placeholder="Escribe tu observación de fauna o huella..." value="${logForMe ? format.escapeHtml(logForMe.text) : ''}" maxlength="240" aria-label="Tu observación de cumbre">
          <button type="button" class="btn btn-secondary so-log__btn" data-role="log-sign">
            <span class="material-symbols-outlined" aria-hidden="true">edit_note</span>
            Firmar
          </button>
        </div>
        <p class="so-log__hint" data-role="log-hint">${logForMe ? `Firmado en tu teléfono · ${format.formatClockTime(logForMe.signedAt)}` : 'El texto queda guardado solo en este teléfono; no se envía a ningún lado.'}</p>
      </section>` : '';

    /* ---- acciones ---- */
    const next = ctx.next || null;
    const atSummit = !next;
    let primaryLabel;
    if (next) {
      primaryLabel = `Continuar hacia Hito ${next.id} (${String(next.name || '').split(' ')[0]})`;
    } else if (progress >= 0.99) {
      primaryLabel = 'Finalizar travesía';
    } else {
      primaryLabel = 'Continuar recorrido';
    }
    const gated = Boolean(challenge.question) && !hasStamp && !this.challengeAnswered;

    /* ---- pasaporte (panel desplegable) ---- */
    const passportRows = all.map((s) => {
      const on = stamps.includes(s.id);
      return `
        <div class="so-passport__row ${on ? 'so-passport__row--on' : ''}">
          <span class="so-passport__icon material-symbols-outlined" aria-hidden="true">${on ? 'check_circle' : 'lock'}</span>
          <strong class="so-passport__id">${format.escapeHtml(s.id)}</strong>
          <span class="so-passport__name">${format.escapeHtml(s.name)}</span>
          <span class="so-passport__cota">${format.escapeHtml(s.cota || '')}</span>
        </div>`;
    }).join('');

    this.container.innerHTML = `
      <div class="station-overlay" role="dialog" aria-modal="true" aria-label="Estación ${st.id}">
        <div class="station-overlay__backdrop" data-role="backdrop"></div>
        <div class="station-overlay__sheet">
          <header class="station-overlay__header so-header">
            <div class="station-overlay__badge">
              <img src="assets/logo/isotipo-newenko.png" alt="" aria-hidden="true">
            </div>
            <span class="so-header__title">Estación ${format.escapeHtml(st.id)} · ${format.escapeHtml(st.cota || '')}</span>
            <button type="button" class="so-header__close" data-role="close" aria-label="Cerrar estación">
              <span class="material-symbols-outlined">close</span>
            </button>
          </header>

          <div class="station-overlay__body so-body">
            ${banner}
            ${hero}
            ${metrics}
            ${observeHtml}
            ${sectionsHtml}
            ${challengeHtml}
            ${safetyHtml}
            ${logHtml}
          </div>

          <footer class="station-overlay__footer so-footer">
            ${atSummit ? `<p class="so-footer__eyebrow">Estación completada</p>` : ''}
            <button type="button" class="btn btn-primary so-footer__continue" data-role="continue" ${gated ? 'disabled' : ''}>
              <span>${format.escapeHtml(primaryLabel)}</span>
              <span class="material-symbols-outlined" aria-hidden="true">${atSummit && progress >= 0.99 ? 'flag' : 'arrow_forward'}</span>
            </button>
            ${atSummit ? `<p class="so-footer__note">El descenso se realiza por la misma senda; regreso al refugio base estimado ${format.escapeHtml(trail.estimatedDurationMinutes || '—')}.</p>` : ''}
            <button type="button" class="btn btn-secondary so-footer__passport" data-role="passport">
              <span class="material-symbols-outlined" aria-hidden="true">menu_book</span>
              Ver mi pasaporte de sellos
            </button>
            <div class="so-passport" data-role="passport-panel" hidden>
              <div class="so-passport__head">Pasaporte de sellos</div>
              ${passportRows}
            </div>
            <p class="so-footer__brand"><span class="material-symbols-outlined" aria-hidden="true">forest</span> Red de senderos autoguiados · Newenko</p>
          </footer>
        </div>
      </div>
    `;

    this._bindEvents(hasStamp, challenge);
  }

  _bindEvents(hasStamp, challenge) {
    this.container.querySelector('[data-role="backdrop"]').addEventListener('click', () => this.close());
    this.container.querySelector('[data-role="close"]').addEventListener('click', () => this.close());

    const continueBtn = this.container.querySelector('[data-role="continue"]');
    continueBtn.addEventListener('click', () => {
      if (this.options.onContinue) this.options.onContinue();
      this.close();
    });

    // Pasaporte: despliegue dentro de la propia ficha
    const passportBtn = this.container.querySelector('[data-role="passport"]');
    const passportPanel = this.container.querySelector('[data-role="passport-panel"]');
    passportBtn.addEventListener('click', () => {
      passportPanel.hidden = !passportPanel.hidden;
      passportBtn.setAttribute('aria-expanded', String(!passportPanel.hidden));
      if (!passportPanel.hidden) passportPanel.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    });
    passportBtn.setAttribute('aria-expanded', 'false');

    // Libro de cumbre: guarda local (clave aprobada summitLog)
    const signBtn = this.container.querySelector('[data-role="log-sign"]');
    if (signBtn) {
      const input = this.container.querySelector('[data-role="log-input"]');
      const hint = this.container.querySelector('[data-role="log-hint"]');
      signBtn.addEventListener('click', () => {
        const text = String(input.value || '').trim();
        if (!text) {
          hint.textContent = 'Escribí tu observación antes de firmar.';
          input.focus();
          return;
        }
        const signedAt = Date.now();
        storage.set('summitLog', { stationId: this.station.id, text, signedAt });
        hint.textContent = `Firmado en tu teléfono · ${format.formatClockTime(signedAt)}`;
      });
    }

    if (!hasStamp && challenge.options) {
      this.container.querySelectorAll('[data-option]').forEach((btn) => {
        btn.addEventListener('click', () => this._handleAnswer(btn, challenge));
      });
    }
  }

  _handleAnswer(btn, challenge) {
    const selectedIndex = parseInt(btn.getAttribute('data-option'), 10);
    const isCorrect = selectedIndex === challenge.correctIndex;

    // Marca todas las opciones como respondidas
    this.container.querySelectorAll('[data-option]').forEach((b) => {
      b.classList.add('station-overlay__option--answered');
      b.disabled = true;
      b.setAttribute('aria-checked', 'false');
    });

    // Resalta correcta/incorrecta
    btn.classList.add(isCorrect ? 'station-overlay__option--correct' : 'station-overlay__option--incorrect');
    btn.setAttribute('aria-checked', 'true');

    // Muestra la correcta si se equivocó
    if (!isCorrect) {
      const correctBtn = this.container.querySelector(`[data-option="${challenge.correctIndex}"]`);
      if (correctBtn) correctBtn.classList.add('station-overlay__option--correct');
    }

    if (isCorrect) {
      // Timbrado del sello (guardado local)
      saveStamp(this.station.id);
      this.challengeAnswered = true;

      const stampEarned = this.container.querySelector('.station-overlay__stamp-earned');
      if (stampEarned) {
        stampEarned.querySelector('[data-role="stamp-text"]').textContent = `¡Sello obtenido: ${challenge.badge}!`;
        stampEarned.hidden = false;
        stampEarned.classList.add('station-overlay__stamp-earned--animate');
      }

      // Habilita el botón de continuar
      setTimeout(() => {
        const continueBtn = this.container.querySelector('[data-role="continue"]');
        if (continueBtn) continueBtn.disabled = false;
      }, 600);
    }
  }

  // Último clima leído (live o caché) en la fila de datos del héroe
  setWeather(state) {
    const el = this.container.querySelector('[data-weather="temp"]');
    if (!el) return;
    el.textContent = state ? format.formatTemp(state.tempC) : '—';
  }
}
