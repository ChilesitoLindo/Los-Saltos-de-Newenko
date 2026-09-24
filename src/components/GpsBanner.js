const ICONS = {
  searching: '<svg class="spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 3a9 9 0 019 9" stroke-linecap="round"/></svg>',
  active: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2" fill="currentColor"/></svg>',
  'low-accuracy': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M4 16v3M9 13v6M14 9v10M19 5v14" stroke-linecap="round"/></svg>',
  'off-route': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 4L2 20h20z" stroke-linejoin="round"/><path d="M12 10v4M12 17.5v.5" stroke-linecap="round"/></svg>',
  'no-permission': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="M6 6l12 12" stroke-linecap="round"/></svg>'
};

const COPY = {
  searching: {
    title: 'Calibrando señal satelital en el dosel...',
    sub: 'El progreso queda en pausa, no se pierde.'
  },
  active: (acc) => ({
    title: 'En ruta',
    sub: acc ? `Precisión ±${Math.round(acc)}m` : 'Señal GPS estable'
  }),
  'low-accuracy': {
    title: 'Señal satelital débil bajo coigües',
    sub: 'Seguimos tu trazado, pero no confirmes desvíos con esta precisión.'
  },
  'off-route': {
    title: 'Fuera de huella · Retorna al sendero',
    sub: '3 lecturas seguidas a >25m del trazado oficial.'
  },
  'no-permission': {
    title: 'Activa la ubicación para seguir tu recorrido',
    sub: 'Sin permiso no hay navegación. El mapa y las estaciones ya descargadas siguen disponibles.'
  }
};

const CLASS_BY_STATE = {
  searching: 'gps-banner--searching',
  active: 'gps-banner--active',
  'low-accuracy': 'gps-banner--weak',
  'off-route': 'gps-banner--offroute',
  'no-permission': 'gps-banner--noperm'
};

export class GpsBanner {
  constructor(container) {
    this.container = container;
    this._elm = null;
    this._icon = null;
    this._title = null;
    this._sub = null;
    this._current = null;
  }

  mount() {
    this.container.innerHTML = `
      <div class="gps-banner" data-role="banner" role="status" aria-live="polite" hidden>
        <span class="gps-banner__icon" data-role="icon"></span>
        <div class="gps-banner__content">
          <strong data-role="title"></strong>
          <span class="gps-banner__sub" data-role="sub"></span>
        </div>
        <span class="gps-banner__cota" data-role="cota" hidden></span>
        <span class="gps-banner__delta" data-role="delta" hidden></span>
      </div>
    `;
    this._elm = this.container.querySelector('[data-role="banner"]');
    this._icon = this.container.querySelector('[data-role="icon"]');
    this._title = this.container.querySelector('[data-role="title"]');
    this._sub = this.container.querySelector('[data-role="sub"]');
    this._cota = this.container.querySelector('[data-role="cota"]');
    this._delta = this.container.querySelector('[data-role="delta"]');
  }

  show(state, accuracy = null) {
    const copy = typeof COPY[state] === 'function' ? COPY[state](accuracy) : COPY[state];
    const cls = CLASS_BY_STATE[state] || 'gps-banner--active';

    this._elm.className = `gps-banner ${cls}`;
    this._elm.hidden = false;
    this._icon.innerHTML = ICONS[state] || ICONS.active;
    this._title.textContent = copy.title;
    this._sub.textContent = copy.sub;
    this._current = state;
  }

  hide() {
    if (this._elm) this._elm.hidden = true;
    this._current = null;
  }

  setCota(cotaText) {
    if (!this._cota) return;
    if (!cotaText) {
      this._cota.hidden = true;
      return;
    }
    this._cota.textContent = `▲ ${cotaText}`;
    this._cota.hidden = false;
  }

  // Desnivel acumulado vs. cota base (columna DESNIVEL del mockup 03)
  setDesnivel(text) {
    if (!this._delta) return;
    if (!text) {
      this._delta.hidden = true;
      return;
    }
    this._delta.textContent = text;
    this._delta.hidden = false;
  }

  get state() {
    return this._current;
  }
}