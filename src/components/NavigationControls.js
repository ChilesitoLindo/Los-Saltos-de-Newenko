// ============================================================
// NavigationControls — acciones de campo de la pantalla 03.
// Copy v2: botón principal con etiqueta dinámica del próximo
// hito («Escanear QR S2») y botón SOS (opciones de seguridad
// y pausa). Conserva iniciar/pausar y centrar mapa.
// ============================================================
export class NavigationControls {
  constructor(container, options = {}) {
    this.container = container;
    this.onStart = options.onStart || (() => {});
    this.onStop = options.onStop || (() => {});
    this.onCenter = options.onCenter || (() => {});
    this.onScan = options.onScan || (() => {});
    this.onSafety = options.onSafety || (() => {});
    this._running = false;
    this._scanId = null;
  }

  mount() {
    this.container.innerHTML = `
      <div class="nav-controls">
        <button type="button" class="btn btn-primary nav-controls__toggle" data-role="toggle">
          <span class="material-symbols-outlined" data-icon="start" aria-hidden="true">play_arrow</span>
          <span class="nav-controls__toggle-text">Iniciar expedición</span>
        </button>
        <div class="nav-controls__row">
          <button type="button" class="btn btn-secondary nav-controls__scan" data-role="scan">
            <span class="material-symbols-outlined" aria-hidden="true">qr_code_scanner</span>
            <span data-role="scan-text">Escanear QR</span>
          </button>
          <button type="button" class="btn btn-secondary nav-controls__sos" data-role="sos" aria-label="Opciones de seguridad y pausa">
            <span class="material-symbols-outlined" aria-hidden="true">sos</span>
            <span>SOS</span>
          </button>
          <button type="button" class="btn btn-icon nav-controls__center" data-role="center" aria-label="Centrar mapa en tu ubicación">
            <span class="material-symbols-outlined" aria-hidden="true">my_location</span>
          </button>
        </div>
      </div>
    `;

    this._els = {
      toggle: this.container.querySelector('[data-role="toggle"]'),
      scan: this.container.querySelector('[data-role="scan"]'),
      scanText: this.container.querySelector('[data-role="scan-text"]'),
      sos: this.container.querySelector('[data-role="sos"]'),
      center: this.container.querySelector('[data-role="center"]'),
      toggleIcon: this.container.querySelector('[data-icon="start"]'),
      toggleText: this.container.querySelector('.nav-controls__toggle-text')
    };

    this._els.toggle.addEventListener('click', () => this._toggle());
    this._els.scan.addEventListener('click', () => this.onScan());
    this._els.sos.addEventListener('click', () => this.onSafety());
    this._els.center.addEventListener('click', () => this.onCenter());
  }

  // Etiqueta dinámica: el próximo hito marca qué QR hay que escanear
  setScanTarget(stationId) {
    if (!this._els || this._scanId === stationId) return;
    this._scanId = stationId;
    this._els.scanText.textContent = stationId ? `Escanear QR ${stationId}` : 'Escanear QR';
  }

  _toggle() {
    if (this._running) {
      this.onStop();
    } else {
      this.onStart();
    }
  }

  render(running) {
    this._running = running;
    if (!this._els) return;
    this._els.toggleIcon.textContent = running ? 'pause' : 'play_arrow';
    this._els.toggleText.textContent = running ? 'Pausar expedición' : 'Continuar expedición';
    this._els.toggle.classList.toggle('nav-controls__toggle--running', running);
  }
}
