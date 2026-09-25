export class NavigationControls {
  constructor(container, options = {}) {
    this.container = container;
    this.onStart = options.onStart || (() => {});
    this.onStop = options.onStop || (() => {});
    this.onCenter = options.onCenter || (() => {});
    this.onScan = options.onScan || (() => {});
    this.onInfo = options.onInfo || options.onSafety || (() => {});
    this._running = false;
    this._started = false;
    this._scanId = null;
    this._els = null;
  }

  mount() {
    this.container.innerHTML = `
      <div class="gps-controls">
        <button type="button" class="gps-cta" data-role="toggle" data-running="0">
          <span class="material-symbols-outlined" data-role="toggle-icon" aria-hidden="true">directions_walk</span>
          <span data-role="toggle-text">Iniciar caminata</span>
        </button>
        <button type="button" class="gps-tool" data-role="scan" aria-label="Escanear señal QR de la próxima estación">
          <span class="material-symbols-outlined" aria-hidden="true">qr_code_scanner</span>
          <span class="gps-tool__badge" data-role="scan-badge">S1</span>
        </button>
        <button type="button" class="gps-tool gps-tool--info" data-role="info" aria-label="Abrir información de seguridad y orientación">
          <span class="material-symbols-outlined" aria-hidden="true">info</span>
        </button>
        <button type="button" class="gps-tool" data-role="center" aria-label="Centrar en mi posición">
          <span class="material-symbols-outlined" aria-hidden="true">my_location</span>
        </button>
      </div>
    `;

    this._els = {
      toggle: this.container.querySelector('[data-role="toggle"]'),
      toggleIcon: this.container.querySelector('[data-role="toggle-icon"]'),
      toggleText: this.container.querySelector('[data-role="toggle-text"]'),
      scan: this.container.querySelector('[data-role="scan"]'),
      scanBadge: this.container.querySelector('[data-role="scan-badge"]'),
      center: this.container.querySelector('[data-role="center"]'),
      info: this.container.querySelector('[data-role="info"]')
    };

    this._els.toggle.addEventListener('click', () => this._toggle());
    this._els.scan.addEventListener('click', () => this.onScan());
    this._els.info.addEventListener('click', () => this.onInfo());
    this._els.center.addEventListener('click', () => this.onCenter());
  }

  setScanTarget(stationId) {
    if (!this._els || this._scanId === stationId) return;
    this._scanId = stationId;
    const label = stationId || 'S1';
    this._els.scanBadge.textContent = label;
    this._els.scan.setAttribute('aria-label', `Escanear señal QR de la estación ${label}`);
  }

  _toggle() {
    if (this._running) this.onStop();
    else this.onStart();
  }

  render(running) {
    this._running = !!running;
    if (this._running) this._started = true;
    if (!this._els) return;
    this._els.toggle.dataset.running = this._running ? '1' : '0';
    this._els.toggleIcon.textContent = this._running ? 'pause' : this._started ? 'play_arrow' : 'directions_walk';
    this._els.toggleText.textContent = this._running ? 'Pausar caminata' : this._started ? 'Reanudar caminata' : 'Iniciar caminata';
  }
}
