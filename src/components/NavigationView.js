import { MapView } from './MapView.js';
import { ProgressCard } from './ProgressCard.js';
import { NavigationControls } from './NavigationControls.js';
import { GpsBanner } from './GpsBanner.js';

export class NavigationView {
  constructor(options = {}) {
    this.options = options;
    this.mapView = null;
    this.banner = null;
    this.progressCard = null;
    this.controls = null;
    this._mounted = false;
    this._veil = null;
    this._veilTitle = null;
    this._veilSub = null;
    this._offCard = null;
    this._offTitle = null;
    this._offNote = null;
    this._log = null;
  }

  mount(root, ctx) {
    this.root = root;
    const { line, stations, profile, trail } = ctx;
    this._trail = trail || {};

    root.innerHTML = `
      <div class="nav-view">
        <div class="nav-view__stage">
          <div class="nav-view__map" data-role="map"></div>
          <div class="nav-view__veil" data-role="veil" role="status" aria-live="polite" hidden>
            <strong data-role="veil-title"></strong>
            <span class="nav-view__veil-sub" data-role="veil-sub"></span>
          </div>
          <div class="nav-view__banner" data-role="banner"></div>
        </div>
        <div class="nav-view__footer">
          <div class="nav-view__offroute" data-role="offroute" hidden>
            <div class="nav-view__offroute-head">
              <span class="material-symbols-outlined" aria-hidden="true">warning</span>
              <div>
                <strong data-role="offroute-title"></strong>
                <span class="nav-view__offroute-note" data-role="offroute-note"></span>
              </div>
            </div>
            <div class="nav-view__offroute-actions">
              <button type="button" class="btn btn-primary" data-role="offroute-retake">Volver al trazado</button>
              <button type="button" class="btn btn-ghost" data-role="offroute-snooze">Silenciar 5 min</button>
            </div>
          </div>
          <div class="nav-view__card" data-role="card"></div>
          <div class="nav-view__controls" data-role="controls"></div>
        </div>
      </div>
    `;

    const mapEl = root.querySelector('[data-role="map"]');
    this.mapView = new MapView(mapEl, { line, stations, fitOnReady: true, allowMapMode: true });
    if (!this.mapView.init()) {
      mapEl.innerHTML = '<div class="map-fallback"><p>El mapa no está disponible ahora.</p><p>Podés seguir el recorrido con el GPS y la señalización del sendero.</p></div>';
      this.mapView = null;
    }

    this.banner = new GpsBanner(root.querySelector('[data-role="banner"]'));
    this.banner.mount();

    this.progressCard = new ProgressCard(
      root.querySelector('[data-role="card"]'),
      {
        onOpenStation: this.options.onOpenStation || (() => {}),
        profile,
        trail: trail || {},
        stations
      }
    );
    this.progressCard.mount();

    this.controls = new NavigationControls(
      root.querySelector('[data-role="controls"]'),
      {
        onStart: this.options.onStart || (() => {}),
        onStop: this.options.onStop || (() => {}),
        onCenter: this.options.onCenter || (() => {}),
        onScan: this.options.onScan || (() => {}),
        onSafety: this.options.onSafety || (() => {})
      }
    );
    this.controls.mount();

    this._veil = root.querySelector('[data-role="veil"]');
    this._veilTitle = root.querySelector('[data-role="veil-title"]');
    this._veilSub = root.querySelector('[data-role="veil-sub"]');
    this._offCard = root.querySelector('[data-role="offroute"]');
    this._offTitle = root.querySelector('[data-role="offroute-title"]');
    this._offNote = root.querySelector('[data-role="offroute-note"]');

    this._offCard.querySelector('[data-role="offroute-retake"]').addEventListener('click', () => {
      this.options.onRetake && this.options.onRetake();
      this.hideOffroute();
    });
    this._offCard.querySelector('[data-role="offroute-snooze"]').addEventListener('click', () => {
      this.hideOffroute();
    });

    this._mounted = true;
  }

  setPosition(position) {
    if (!this.mapView) return;
    this.mapView.setPosition(position);
  }

  centerOn(position) {
    if (!this.mapView || !position) return;
    this.mapView.centerOn(position);
  }

  setProgress(progress, nextStation) {
    if (!this._mounted) return;
    this.progressCard.update(progress);
    // Distancia al próximo hito (no al final de la ruta): Sx.routeProgress - avance
    let distToNext = null;
    const total = Number(this._trail && this._trail.distanceMeters);
    if (
      nextStation &&
      Number.isFinite(total) && total > 0 &&
      Number.isFinite(Number(nextStation.routeProgress)) &&
      Number.isFinite(Number(progress.progress))
    ) {
      distToNext = Math.max(0, (Number(nextStation.routeProgress) - Number(progress.progress)) * total);
    }
    this.progressCard.setNextStation(nextStation, distToNext);
    // Acción principal apunta al próximo hito: «Escanear QR S2»
    if (this.controls) this.controls.setScanTarget(nextStation ? nextStation.id : null);
  }

  _hideVeil() {
    if (this._veil) this._veil.hidden = true;
  }

  _showVeil(title, sub) {
    if (!this._veil) return;
    this._veilTitle.textContent = title;
    this._veilSub.textContent = sub;
    this._veil.hidden = false;
  }

  hideOffroute() {
    if (this._offCard) this._offCard.hidden = true;
  }

  setStatus({ status, message, accuracy }) {
    if (!this.banner) return;

    if (status === 'stopped') {
      this.banner.hide();
      this._hideVeil();
      this.hideOffroute();
    }

    // Estado 'active' (modo marcha): el banner de telemetría queda visible
    // con el estado satelital y la cota actual (spec §5, pantalla 03).
    if (status === 'active') {
      this.banner.show('active', accuracy);
      this._hideVeil();
      this.hideOffroute();
    }

    if (status === 'searching') {
      this.banner.show('searching');
      this._showVeil('Calibrando señal satelital en el dosel...', 'Mantené el teléfono con vista al cielo unos segundos.');
    }

    if (status === 'low-accuracy') {
      this.banner.show('low-accuracy', accuracy);
      this._hideVeil();
    }

    if (status === 'off-route') {
      this.banner.show('off-route', accuracy);
      this._hideVeil();
      this._offTitle.textContent = message || 'Te alejaste del sendero.';
      this._offNote.textContent = 'Vuelve al punto marcado en el mapa. El bosque es denso aquí.';
      this._offCard.hidden = false;
      if ('vibrate' in navigator) navigator.vibrate([120, 60, 120]);
    }

    if (status === 'no-permission') {
      this.banner.show('no-permission');
      this._showVeil('Ubicación desactivada', 'Actívala en el navegador para retomar el guiado.');
      this.hideOffroute();
    }
  }

  setOffline(isOffline) {
    // Handled by TopAppBar
  }

  setCota(cotaText) {
    if (this.banner) this.banner.setCota(cotaText);
  }

  setDesnivel(desnivelText) {
    if (this.banner) this.banner.setDesnivel(desnivelText);
  }

  renderControls(running) {
    if (this.controls) this.controls.render(running);
  }

  destroy() {
    if (this.mapView) this.mapView.destroy();
    this.root = null;
    this._mounted = false;
  }
}