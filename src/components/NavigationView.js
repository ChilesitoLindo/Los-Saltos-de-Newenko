import { MapView } from './MapView.js';
import { ProgressCard } from './ProgressCard.js';
import { NavigationControls } from './NavigationControls.js';
import { GpsBanner } from './GpsBanner.js';
import { geo } from '../utils/geo.js';
import { showToast } from '../utils/toast.js';

const BANNER_STATE = {
  stopped: 'idle',
  searching: 'searching',
  active: 'active',
  'low-accuracy': 'low',
  'off-route': 'offroute',
  'no-permission': 'denied'
};

export class NavigationView {
  constructor(options = {}) {
    this.options = options;
    this.mapView = null;
    this.banner = null;
    this.progressCard = null;
    this.controls = null;
    this._mounted = false;
    this._line = [];
    this._stations = [];
    this._lastPosition = null;
    this._lastStatus = 'stopped';
    this._offrouteMutedUntil = 0;
    this._onOnline = null;
    this._onOffline = null;
    this._mapModeButton = null;
    this._coverageButton = null;
    this._coverageText = null;
    this._compassButton = null;
    this._compassIcon = null;
    this._veil = null;
    this._veilTitle = null;
    this._veilSub = null;
    this._offCard = null;
    this._offTitle = null;
    this._offNote = null;
  }

  mount(root, ctx = {}) {
    this.root = root;
    this._line = Array.isArray(ctx.line) ? ctx.line : [];
    this._stations = Array.isArray(ctx.stations) ? ctx.stations : [];
    this._trail = ctx.trail || {};

    root.innerHTML = `
      <section class="gps-reference" data-role="gps-reference" aria-label="Vista GPS del sendero">
        <div class="gps-reference__map" data-role="map" aria-label="Mapa del sendero"></div>
        <div class="gps-reference__top-rail">
          <div class="gps-reference__status-group">
            <div data-role="banner"></div>
            <button type="button" class="gps-reference__map-mode gps-glass" data-role="map-mode" aria-pressed="false">
              <span class="material-symbols-outlined" aria-hidden="true">satellite_alt</span>
              <span data-role="map-mode-text">Satélite</span>
            </button>
          </div>
          <div class="gps-reference__top-actions">
            ${this.options.onExit ? `<button type="button" class="gps-reference__exit gps-glass" data-role="exit" aria-label="Volver al inicio"><span class="material-symbols-outlined" aria-hidden="true">home</span><span data-role="exit-text">Inicio</span></button>` : ''}
            <button type="button" class="gps-reference__coverage gps-glass" data-role="coverage" aria-live="polite">
              <span class="material-symbols-outlined" data-role="coverage-icon" aria-hidden="true">signal_cellular_alt</span>
              <span data-role="coverage-text">Conectado</span>
            </button>
          </div>
        </div>
        <div data-role="hud"></div>
        <div class="gps-reference__veil" data-role="veil" role="status" aria-live="polite" hidden>
          <strong data-role="veil-title">Ubicación desactivada</strong>
          <span data-role="veil-sub">Actívala en el navegador para retomar el guiado.</span>
        </div>
        <div class="gps-reference__offcard" data-role="offroute" hidden>
          <div class="gps-reference__offcard-title">
            <span class="material-symbols-outlined" aria-hidden="true">warning</span>
            <strong data-role="offroute-title">Te alejaste del sendero</strong>
          </div>
          <p data-role="offroute-note">Vuelve al punto marcado en el mapa. El bosque es denso aquí.</p>
          <div class="gps-reference__offcard-actions">
            <button type="button" data-role="offroute-retake">Volver al trazado</button>
            <button type="button" data-role="offroute-snooze">Silenciar 5 min</button>
          </div>
        </div>
        <button type="button" class="gps-reference__compass gps-glass" data-role="compass" aria-pressed="false" aria-label="Orientar el mapa hacia donde miro">
          <span class="material-symbols-outlined" data-role="compass-icon" aria-hidden="true">explore</span>
        </button>
        <div class="gps-reference__credit">© OpenStreetMap contributors · Tiles © Esri</div>
        <div data-role="controls"></div>
      </section>
    `;

    const mapEl = root.querySelector('[data-role="map"]');
    this.mapView = new MapView(mapEl, {
      line: this._line,
      stations: this._stations,
      fitOnReady: true,
      allowMapMode: false,
      showModeToggle: false,
      showOfflineNote: false,
      navigationMode: true,
      onTileError: () => {
        this._syncMapMode('standard');
        showToast('La vista satelital no está disponible; se mostró el mapa estándar.', 'error');
      }
    });
    if (!this.mapView.init()) {
      mapEl.innerHTML = '<div class="map-fallback"><p>El mapa no está disponible ahora.</p><p>Podés seguir el recorrido con la señalización del sendero.</p></div>';
      this.mapView = null;
    }

    this.banner = new GpsBanner(root.querySelector('[data-role="banner"]'), {
      onClick: () => this._showStatusMessage()
    });
    this.banner.mount();

    this.progressCard = new ProgressCard(root.querySelector('[data-role="hud"]'), {
      profile: ctx.profile,
      trail: this._trail,
      stations: this._stations,
      onOpenStation: this.options.onOpenStation || (() => {})
    });
    this.progressCard.mount();

    this.controls = new NavigationControls(root.querySelector('[data-role="controls"]'), {
      onStart: this.options.onStart || (() => {}),
      onStop: this.options.onStop || (() => {}),
      onCenter: this.options.onCenter || (() => {}),
      onScan: this.options.onScan || (() => {}),
      onInfo: this.options.onInfo || this.options.onSafety || (() => {})
    });
    this.controls.mount();

    this._mapModeButton = root.querySelector('[data-role="map-mode"]');
    this._coverageButton = root.querySelector('[data-role="coverage"]');
    this._coverageText = root.querySelector('[data-role="coverage-text"]');
    this._compassButton = root.querySelector('[data-role="compass"]');
    this._compassIcon = root.querySelector('[data-role="compass-icon"]');
    this._veil = root.querySelector('[data-role="veil"]');
    this._veilTitle = root.querySelector('[data-role="veil-title"]');
    this._veilSub = root.querySelector('[data-role="veil-sub"]');
    this._offCard = root.querySelector('[data-role="offroute"]');
    this._offTitle = root.querySelector('[data-role="offroute-title"]');
    this._offNote = root.querySelector('[data-role="offroute-note"]');

    this._mapModeButton.addEventListener('click', () => this._toggleMapMode());
    this._compassButton.addEventListener('click', () => this._toggleCompass());
    this._coverageButton.addEventListener('click', () => this._showCoverageMessage());
    this._offCard.querySelector('[data-role="offroute-retake"]').addEventListener('click', () => this._retakeRoute());
    this._offCard.querySelector('[data-role="offroute-snooze"]').addEventListener('click', () => this._snoozeOffroute());

    const exit = root.querySelector('[data-role="exit"]');
    if (exit) exit.addEventListener('click', () => this.options.onExit());

    this._onOnline = () => this._updateCoverage();
    this._onOffline = () => this._updateCoverage();
    window.addEventListener('online', this._onOnline);
    window.addEventListener('offline', this._onOffline);
    this._updateCoverage();
    this._syncMapMode(this.mapView ? this.mapView.getMode() : 'standard');
    this._mounted = true;
  }

  _syncMapMode(mode) {
    if (!this._mapModeButton) return;
    const satellite = mode === 'satellite';
    this._mapModeButton.dataset.on = satellite ? '1' : '0';
    this._mapModeButton.setAttribute('aria-pressed', String(satellite));
    this._mapModeButton.setAttribute('aria-label', satellite ? 'Cambiar a mapa estándar' : 'Cambiar a vista satelital');
    const text = this._mapModeButton.querySelector('[data-role="map-mode-text"]');
    if (text) text.textContent = satellite ? 'Mapa' : 'Satélite';
  }

  _toggleMapMode() {
    if (!this.mapView) return;
    const mode = this.mapView.toggleMode();
    this._syncMapMode(mode);
    showToast(mode === 'satellite' ? 'Vista satelital activada' : 'Volviste al mapa estándar', 'ok');
  }

  _toggleCompass() {
    if (!this.mapView) return;
    const enabled = this.mapView.toggleHeadingUp();
    if (this._compassButton) {
      this._compassButton.dataset.on = enabled ? '1' : '0';
      this._compassButton.setAttribute('aria-pressed', String(enabled));
    }
    if (this._compassIcon) this._compassIcon.style.transform = enabled ? 'rotate(45deg)' : '';
    showToast(enabled ? 'Mapa orientado hacia tu rumbo' : 'Mapa con norte hacia arriba', 'ok');
  }

  _updateCoverage(forceOffline) {
    if (!this._coverageButton || !this._coverageText) return;
    const online = forceOffline === undefined ? navigator.onLine !== false : !forceOffline;
    this._coverageButton.dataset.offline = online ? '0' : '1';
    this._coverageButton.setAttribute('aria-label', online ? 'Conectado a la red' : 'Sin conexión a la red');
    this._coverageText.textContent = online ? 'Conectado' : 'Sin conexión';
    const icon = this._coverageButton.querySelector('[data-role="coverage-icon"]');
    if (icon) icon.textContent = online ? 'signal_cellular_alt' : 'cloud_off';
  }

  _showCoverageMessage() {
    showToast(navigator.onLine === false ? 'Los mosaicos pueden tardar en cargar sin conexión.' : 'Conectado · el GPS sigue funcionando localmente.', 'ok');
  }

  _showStatusMessage() {
    const labels = {
      idle: 'GPS listo',
      searching: 'Calibrando señal satelital',
      active: 'En ruta',
      low: 'Señal GPS débil',
      offroute: 'Fuera de la huella',
      denied: 'Ubicación desactivada'
    };
    showToast(labels[BANNER_STATE[this._lastStatus] || 'idle'], 'ok');
  }

  _retakeRoute() {
    this._offrouteMutedUntil = 0;
    if (this.options.onRetake) this.options.onRetake();
    this.hideOffroute();
    showToast('De vuelta al trazado. Seguí la huella amarilla.', 'ok');
  }

  _snoozeOffroute() {
    this._offrouteMutedUntil = Date.now() + 5 * 60 * 1000;
    this.hideOffroute();
    showToast('Alertas de salida silenciadas por 5 min', 'ok');
  }

  setPosition(position) {
    this._lastPosition = position;
    if (this.mapView) this.mapView.setPosition(position);
    if (this._lastStatus === 'off-route' && position && this._line.length > 1) {
      const nearest = geo.findNearestSegment(position, this._line);
      if (nearest && this._offNote) {
        this._offNote.textContent = `Tu posición quedó a ${Math.round(nearest.distance)} m de la traza. Volvé a la huella amarilla.`;
      }
    }
  }

  centerOn(position) {
    if (!this.mapView) return;
    this.mapView.centerOn(position);
    const headingUp = this.mapView.isHeadingUp;
    this._compassButton.dataset.on = headingUp ? '1' : '0';
    this._compassButton.setAttribute('aria-pressed', String(headingUp));
    if (this._compassIcon) this._compassIcon.style.transform = '';
  }

  setProgress(progress, nextStation) {
    if (!this._mounted) return;
    this.progressCard.update(progress);
    if (this.mapView) this.mapView.setProgress(progress && progress.progress);
    const total = Number(progress && progress.total);
    const fraction = Number(progress && progress.progress);
    const stationProgress = Number(nextStation && nextStation.routeProgress);
    let distance = null;
    if (nextStation && Number.isFinite(total) && Number.isFinite(fraction) && Number.isFinite(stationProgress)) {
      distance = Math.max(0, (stationProgress - fraction) * total);
    }
    this.progressCard.setNextStation(nextStation, distance);
    this.controls.setScanTarget(nextStation ? nextStation.id : (this._stations[this._stations.length - 1] || {}).id);
  }

  setStatus({ status, message, accuracy } = {}) {
    if (!this._mounted) return;
    this._lastStatus = status || 'stopped';
    const bannerState = BANNER_STATE[this._lastStatus] || 'idle';
    if (this._lastStatus === 'off-route' && Date.now() < this._offrouteMutedUntil) {
      this.hideOffroute();
      return;
    }
    this.banner.show(bannerState, accuracy);
    this._mapModeButton && this._mapModeButton.classList.remove('is-alert');
    this._compassButton && this._compassButton.classList.remove('is-alert');

    if (this._lastStatus === 'no-permission') {
      this._veilTitle.textContent = 'Ubicación desactivada';
      this._veilSub.textContent = 'Actívala en el navegador para retomar el guiado.';
      this._veil.hidden = false;
      this.hideOffroute();
    } else {
      this._veil.hidden = true;
    }

    if (this._lastStatus === 'off-route') {
      this._offTitle.textContent = 'Te alejaste del sendero';
      this._offNote.textContent = message || 'Vuelve al punto marcado en el mapa. El bosque es denso aquí.';
      this._offCard.hidden = false;
      this._compassButton && this._compassButton.classList.add('is-alert');
    } else {
      this.hideOffroute();
    }
  }

  hideOffroute() {
    if (this._offCard) this._offCard.hidden = true;
  }

  setCota(cotaText) {
    if (this.progressCard) this.progressCard.setCota(cotaText);
  }

  setDesnivel(deltaText) {
    if (this.progressCard) this.progressCard.setDesnivel(deltaText);
  }

  setOffline(isOffline) {
    this._updateCoverage(isOffline);
  }

  renderControls(running) {
    if (this.controls) this.controls.render(running);
  }

  destroy() {
    window.removeEventListener('online', this._onOnline);
    window.removeEventListener('offline', this._onOffline);
    if (this.mapView) this.mapView.destroy();
    this.mapView = null;
    this.root = null;
    this._mounted = false;
  }
}
