const COPY = {
  idle: { title: 'GPS listo', detail: 'Listo para comenzar' },
  searching: { title: 'Calibrando…', detail: 'Buscando satélites' },
  active: { title: 'En ruta', detail: 'Señal GPS activa' },
  paused: { title: 'Marcha en pausa', detail: 'Progreso conservado' },
  low: { title: 'Señal débil', detail: 'Precisión reducida bajo el dosel' },
  offroute: { title: 'Fuera de la huella', detail: 'Vuelve al trazado señalizado' },
  denied: { title: 'Ubicación desactivada', detail: 'Actívala para continuar' }
};

const ICONS = {
  idle: 'gps_fixed',
  searching: 'my_location',
  active: 'near_me',
  paused: 'pause',
  low: 'location_searching',
  offroute: 'warning',
  denied: 'location_off'
};

const normalizeState = (state) => {
  if (state === 'stopped') return 'idle';
  if (state === 'low-accuracy') return 'low';
  if (state === 'off-route') return 'offroute';
  if (state === 'no-permission') return 'denied';
  return state || 'idle';
};

export class GpsBanner {
  constructor(container, options = {}) {
    this.container = container;
    this.onClick = options.onClick || (() => {});
    this._elm = null;
    this._icon = null;
    this._title = null;
    this._accuracy = null;
    this._current = null;
  }

  mount() {
    this.container.innerHTML = `
      <button type="button" class="gps-status-pill gps-glass" data-state="idle" data-role="status-pill" aria-live="polite">
        <span class="gps-status-pill__state" aria-hidden="true"></span>
        <span class="material-symbols-outlined gps-status-pill__icon" data-role="status-icon" aria-hidden="true">gps_fixed</span>
        <span class="gps-status-pill__title" data-role="status-title">GPS listo</span>
        <span class="gps-status-pill__accuracy" data-role="status-accuracy"></span>
      </button>
    `;
    this._elm = this.container.querySelector('[data-role="status-pill"]');
    this._icon = this.container.querySelector('[data-role="status-icon"]');
    this._title = this.container.querySelector('[data-role="status-title"]');
    this._accuracy = this.container.querySelector('[data-role="status-accuracy"]');
    this._elm.addEventListener('click', () => this.onClick(this._current));
  }

  show(state, accuracy = null) {
    if (!this._elm) return;
    const normalized = normalizeState(state);
    const copy = COPY[normalized] || COPY.idle;
    const numericAccuracy = Number(accuracy);
    let accuracyText = '';
    if (normalized === 'searching') accuracyText = 'buscando…';
    else if (normalized !== 'denied' && Number.isFinite(numericAccuracy)) accuracyText = `±${Math.round(numericAccuracy)} m`;

    this._elm.dataset.state = normalized;
    this._icon.textContent = ICONS[normalized] || ICONS.idle;
    this._title.textContent = copy.title;
    this._accuracy.textContent = accuracyText;
    this._elm.title = copy.detail;
    this._elm.setAttribute('aria-label', accuracyText ? `${copy.title}, ${accuracyText}` : copy.title);
    this._current = normalized;
  }

  hide() {
    this.show('idle');
  }

  setCota() {}

  setDesnivel() {}

  get state() {
    return this._current;
  }
}
