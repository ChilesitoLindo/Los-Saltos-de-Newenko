import { RouteManager } from './managers/RouteManager.js';
import { NavigationManager } from './managers/NavigationManager.js';
import { ProgressManager } from './managers/ProgressManager.js';
import { StationManager } from './managers/StationManager.js';
import { OfflineManager } from './managers/OfflineManager.js';
import { SafetyManager } from './managers/SafetyManager.js';
import { WeatherManager } from './managers/WeatherManager.js';
import { Router } from './router.js';
import { MapView } from './components/MapView.js';
import { NavigationView } from './components/NavigationView.js';
import { WelcomeView } from './components/WelcomeView.js';
import { LoadingScreen } from './components/LoadingScreen.js';
import { SafetyChecklistView } from './components/SafetyChecklistView.js';
import { PortalEntranceView } from './components/PortalEntranceView.js';
import { MapScreen } from './components/MapScreen.js';
import { StationOverlay } from './components/StationOverlay.js';
import { QrScannerModal } from './components/QrScannerModal.js';
import { LegalModal, LEGAL_VERSION } from './components/LegalModal.js';
import { CumbreView } from './components/CumbreView.js';
import { FinalizacionView } from './components/FinalizacionView.js';
import { TopAppBar } from './components/TopAppBar.js';
import { BottomNavBar } from './components/BottomNavBar.js';
import { DemoController } from './demo/DemoController.js';
import { format } from './utils/format.js';
import { storage, saveStamp } from './utils/storage.js';
import { loadData } from './utils/loader.js';
import { buildProfile } from './utils/elevation.js';

const COMPLETION_THRESHOLD = 0.99;

// Fotos reales del sendero (Base de datos → assets/images).
// null = la pantalla usa su fallback de gradiente (dato pendiente).
const PHOTOS = {
  welcomeHero: 'assets/images/panoramica-valle.jpg',
  checklist: 'assets/images/pasarela-tablas-madera.jpg',
  portalHero: 'assets/images/cascada-cortina.jpg',
  completion: 'assets/images/cascada-principal.jpg',
  // pies de foto literales del mockup 02
  gallery: [
    { src: 'assets/images/cascada-principal.jpg', caption: 'Salto Mayor (30m)' },
    { src: 'assets/images/sendero-talud-raices.jpg', caption: 'Tramo S1 - S2 (Sendero)' }
  ]
};

class App {
  constructor() {
    this.root = document.getElementById('app');
    this.demoMode = new URLSearchParams(window.location.search).get('demo') === '1';
    this.trail = { name: 'Los Saltos de Newenko', gps: {} };
    this.route = null;
    this.stations = [];
    this.safety = null;

    this.nav = null;
    this.progress = null;
    this.offline = new OfflineManager();

    this.screen = null;
    this.overlay = null;

    this.navView = null;
    this.mapView = null;
    this.stationOverlay = null;
    this.qrScanner = null;
    this.legalModal = null;
    this.cumbreView = null;
    this.finalizacionView = null;
    this.topAppBar = null;
    this.bottomNavBar = null;

    this.navRunning = false;
    this.lastPosition = null;
    this._completed = false;
    this._followedOnce = false;
    this.demo = null;
  }

  async boot() {
    const loader = new LoadingScreen();
    try {
      loader.start();
      this.offline.init();
      this._connectionOnline = this.offline.isOnline;
      this.offline.onConnectionChange((online) => this._onConnection(online));

      try {
        const res = await loadData('data/trail.json');
        if (res.ok) this.trail = { ...this.trail, ...(await res.json()) };
      } catch {
        // se mantiene el objeto por defecto
      }
      loader.setData(this.trail);

      this.route = new RouteManager();
      const routeOk = await this.route.load();

      this.stationMgr = new StationManager();
      const stationsOk = await this.stationMgr.load();
      this.stations = this.stationMgr.all();

      this.safetyMgr = new SafetyManager();
      this.safety = await this.safetyMgr.load();

      // Perfil altimétrico compartido (00, 01, 02, 03) desde data/
      this.profile = buildProfile({
        trail: this.trail,
        stations: this.stations,
        total: this.route ? this.route.totalDistance : 0
      });

      // Clima en vivo (Open-Meteo) anclado al centro del trazado:
      // cuando entre la ruta real, la ubicación se corrige sola.
      this.weather = new WeatherManager({ onUpdate: (s) => this._onWeather(s) });
      if (routeOk && this.route.line.length >= 2) {
        const line = this.route.line;
        const center = line.reduce((acc, p) => ({ lat: acc.lat + p.lat, lon: acc.lon + p.lon }), { lat: 0, lon: 0 });
        this.weather.init({ lat: center.lat / line.length, lon: center.lon / line.length });
      } else {
        this._onWeather(this.weather.state);
      }

      if (routeOk && this.route.line.length >= 2) {
        this._initNavigationComponents();
      }

      this.router = new Router({ onStation: (value) => this._onStationParam(value) });

      if (!routeOk) {
        this._showNotice('La ruta del sendero no está disponible por ahora. Inténtalo más tarde.');
      }
      if (!stationsOk) {
        this._showNotice('No encontramos las estaciones del sendero por ahora.');
      }

      this._renderShell();
      this._refreshCota();
      this.showWelcome();
      if (!this._hasAcceptedLegal()) {
        this.openLegal({
          requireAcceptance: true,
          onAccept: () => this.router.dispatch()
        });
      } else {
        this.router.dispatch();
      }
      if (this.notice) this._renderNotice(this.notice);
      await loader.finish();
    } catch {
      loader.destroy();
      this._renderFatal();
    }
  }

  _renderShell() {
    this.root.innerHTML = `
      <div id="top-appbar-host"></div>
      <div id="screen-host"></div>
      <div id="bottom-navbar-host"></div>
    `;
    this._topAppBarHost = this.root.querySelector('#top-appbar-host');
    this._screenHost = this.root.querySelector('#screen-host');
    this._bottomNavBarHost = this.root.querySelector('#bottom-navbar-host');

    this.topAppBar = new TopAppBar(this._topAppBarHost, {
      onSafety: () => this.openSafety(),
      onLegal: () => this.openLegal()
    });
    this.topAppBar.mount();

    this.bottomNavBar = new BottomNavBar(this._bottomNavBarHost, {
      onTab: (tab) => this._onTab(tab)
    });
    this.bottomNavBar.mount();
  }

  _setGpsMode(on) {
    this.root.classList.toggle('is-gps', !!on);
    document.body.classList.toggle('is-gps', !!on);
  }

  _initNavigationComponents() {
    const gps = this.trail.gps || {};
    this.nav = new NavigationManager({
      gps,
      line: this.route.line,
      onPosition: (p) => this._onPosition(p)
    });
    this.nav.onStatus((s) => this._onNavStatus(s));

    this.progress = new ProgressManager({
      line: this.route.line,
      regressionConfirmationReadings: gps.regressionToleranceReadings,
      lowAccuracyThreshold: gps.lowAccuracyThreshold
    });
    this.progress.onProgress((snap) => this._onProgress(snap));

    const last = storage.get('lastProgress');
    if (last && Number.isFinite(last.progress) && last.progress > 0) {
      this.progress.confirmed = Math.max(0, Math.min(1, last.progress));
    }

    if (!storage.get('preferredMapMode')) {
      storage.set('preferredMapMode', 'standard');
    }
  }

  _onTab(tab) {
    if (tab === 'inicio') return this.showOperationalStart();
    if (tab === 'mapa') return this.showMap();
    if (tab === 'gps') return this.startNavigation();
    if (tab === 'qr') return this.openScanner();
    if (tab === 'cumbre') {
      const done = this.progress && this.progress.confirmed >= COMPLETION_THRESHOLD;
      if (done) return this._finishRun();
      this._showNotice('Todavía no llegás al final del sendero.');
      return;
    }
  }

  /* ---------- Cota actual (telemetría) ---------- */

  // GPS entrega altitud cuando hay fix; si no, se interpola entre la cota base
  // y la cota de cumbre según el avance confirmado sobre el trazado.
  _currentCota() {
    const pos = this.lastPosition;
    if (pos && Number.isFinite(pos.altitude)) return pos.altitude;
    const start = Number(this.trail.initialCota);
    const end = Number(this.trail.summitCota);
    if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
    const p = this.progress ? Math.min(1, Math.max(0, this.progress.confirmed)) : 0;
    return start + (end - start) * p;
  }

  _refreshCota() {
    const cotaMeters = this._currentCota();
    const cota = format.formatCota(cotaMeters);
    const value = cota === '—' ? null : cota;
    if (this.topAppBar) this.topAppBar.setCota(value);
    if (this.navView) {
      this.navView.setCota(value);
      // Chip de desnivel acumulado vs. cota base (pantalla 03)
      const base = Number(this.trail.initialCota);
      this.navView.setDesnivel(
        Number.isFinite(cotaMeters) && Number.isFinite(base)
          ? format.formatDelta(cotaMeters - base)
          : null
      );
    }
  }

  // Clima: actualiza la pantalla de intro y la ficha de estación abiertas
  _onWeather(state) {
    this.weatherState = state;
    if (this.introView && this.introView.setWeather) this.introView.setWeather(state);
    if (this.stationOverlay && this.stationOverlay.setWeather) this.stationOverlay.setWeather(state);
  }

  /* ---------- Pantallas ---------- */

  /* ---------- Modo intro: la barra inferior vive solo tras
     activar la bitácora (spec experiencia-ux §7). Mantiene los
     5 tabs en DOM; solo cambia visibilidad y el alto reservado. ---------- */

  _isActivated() {
    return !!storage.get('trailSession');
  }

  _setIntroMode(on) {
    this.root.classList.toggle('is-intro', !!on);
  }

  showWelcome() {
    this._clearScreenHost();
    this.screen = 'welcome';
    const wrap = document.createElement('div');
    wrap.className = 'screen';
    this._screenHost.appendChild(wrap);

    // Pantalla 00 presentación editorial (spec §4)
    const view = new WelcomeView(wrap, {
      trail: this.trail,
      stations: this.stations,
      photo: PHOTOS.welcomeHero,
      onStart: () => this.showOperationalStart(),
      onOpenLegal: () => this.openLegal({ requireAcceptance: !this._hasAcceptedLegal() })
    });
    view.mount();
    this.introView = view;

    this._setIntroMode(true);
    this.bottomNavBar.setActive('inicio');
    this.topAppBar.setOffline(!this._connectionOnline);
  }

  showChecklist() {
    this._clearScreenHost();
    this.screen = 'checklist';
    const wrap = document.createElement('div');
    wrap.className = 'screen';
    this._screenHost.appendChild(wrap);

    const activated = this._isActivated();
    const view = new SafetyChecklistView(wrap, {
      trail: this.trail,
      safety: this.safety || {},
      stations: this.stations,
      photo: PHOTOS.checklist,
      activated,
      // El conteo alimenta el bloque "Preparación" de la pantalla 01
      onProgress: (checked) => { this._prepCount = checked; },
      onBack: () => this.showOperationalStart(),
      onActivate: () => this._activateBitacora()
    });
    view.mount();
    this.introView = view;
    this._setIntroMode(true);
    this.bottomNavBar.setActive('inicio');
    this.topAppBar.setOffline(!this._connectionOnline);
  }

  // Pantalla 01 unificada: inicio operacional único (spec §5).
  // La preparación es la puerta: sin bitácora activada el CTA abre
  // el checklist; activada, inicia la experiencia por el mapa.
  showOperationalStart() {
    this._clearScreenHost();
    this.screen = 'start';
    const wrap = document.createElement('div');
    wrap.className = 'screen';
    this._screenHost.appendChild(wrap);

    const checklist = (this.safety && Array.isArray(this.safety.checklist)) ? this.safety.checklist : [];
    const activated = this._isActivated();

    const view = new PortalEntranceView(wrap, {
      trail: this.trail,
      stations: this.stations,
      profile: this.profile,
      line: this.route ? this.route.line : [],
      weather: this.weatherState || (this.weather ? this.weather.state : null),
      photo: PHOTOS.portalHero,
      activated,
      checklistTotal: checklist.length,
      checklistDone: activated ? checklist.length : (this._prepCount || 0),
      onOpenChecklist: () => this.showChecklist(),
      onStart: () => (this._isActivated() ? this.showMap() : this.showChecklist()),
      onOpenLegal: () => this.openLegal({ requireAcceptance: !this._hasAcceptedLegal() }),
      onViewMap: () => this.showMap()
    });
    view.mount();
    this.introView = view;

    this._setIntroMode(!activated);
    this.bottomNavBar.setActive('inicio');
    this.topAppBar.setOffline(!this._connectionOnline);
  }

  // Activación de la bitácora: trailSession pasa a ser el flag de
  // sesión activa (sin claves nuevas). startedAt = momento de la
  // activación, coherente con "desde la activación de la bitácora"
  // de la pantalla de finalización. Landing: Inicio con barra visible.
  _activateBitacora() {
    if (!storage.get('trailSession')) {
      storage.set('trailSession', { startedAt: Date.now() });
    }
    this._prepCount = null;
    this.showOperationalStart();
  }

  showMap() {
    if (!this.route || this.route.line.length < 2) {
      this._showNotice('La ruta del sendero no está disponible por ahora.');
      return this.showOperationalStart();
    }
    this._clearScreenHost();
    this.screen = 'map';

    const screen = document.createElement('div');
    screen.className = 'screen';
    this._screenHost.appendChild(screen);

    // Pantalla 02 (mockup v2): ribbon, mapa, acciones, perfil,
    // timeline de estaciones y fotografías de reconocimiento.
    // intro: acceso desde "Ver mapa" antes de activar la bitácora
    // (sin barra inferior, con vuelta al inicio operacional).
    const intro = !this._isActivated();
    const view = new MapScreen(screen, {
      trail: this.trail,
      stations: this.stations,
      profile: this.profile,
      line: this.route.line,
      gallery: PHOTOS.gallery,
      intro,
      onBack: () => this.showOperationalStart(),
      onStart: () => this.startNavigation()
    });
    view.mount();

    const mapEl = screen.querySelector('[data-role="map"]');
    this.mapView = new MapView(mapEl, { line: this.route.line, stations: this.stations, fitOnReady: true, allowMapMode: true });
    if (!this.mapView.init()) {
      mapEl.innerHTML = '<div class="map-fallback"><p>El mapa no está disponible ahora.</p></div>';
      this.mapView = null;
    }
    if (this.lastPosition) this.mapView?.setPosition(this.lastPosition);

    this._setIntroMode(intro);
    this.bottomNavBar.setActive('mapa');
    this.topAppBar.setOffline(!this._connectionOnline);
  }

  startNavigation() {
    if (!this.nav || !this.progress) {
      this._showNotice('La ruta del sendero no está disponible por ahora.');
      return;
    }
    if (this.screen !== 'navigation') {
      this.showNavigation();
      return;
    }
    this._setNavigationRunning(true);
  }

  showNavigation() {
    if (!this.nav || !this.progress) {
      this._showNotice('La ruta del sendero no está disponible por ahora.');
      return this.showOperationalStart();
    }
    this._clearScreenHost();
    this.screen = 'navigation';
    this._setGpsMode(true);

    const screen = document.createElement('div');
    screen.className = 'screen';
    this._screenHost.appendChild(screen);

    this.navView = new NavigationView({
      onStart: () => this._setNavigationRunning(true),
      onStop: () => this._setNavigationRunning(false),
      onCenter: () => {
        const pos = this.nav?.lastPosition || null;
        if (pos) this.navView.centerOn(pos);
      },
      onScan: () => this.openScanner(),
      onRetake: () => this._retakeNavigation(),
      onExit: () => this._exitNavigation(),
      onInfo: () => this.openSafety(),
      onOpenStation: (id) => this._openStationById(id)
    });
    this.navView.mount(screen, {
      line: this.route.line,
      stations: this.stations,
      profile: this.profile,
      trail: this.trail
    });

    const snap = this.progress.snapshot();
    const next = this.stationMgr.nextStation(snap.progress);
    this.navView.setProgress(snap, next);
    this.navView.renderControls(this.navRunning);

    if (this.demoMode) {
      this.demo = new DemoController(this);
      const demoBar = document.createElement('div');
      demoBar.className = 'demo-host';
      screen.appendChild(demoBar);
      this.demo.mount(demoBar);
    }

    this.bottomNavBar.setActive('gps');
    this.topAppBar.setOffline(!this._connectionOnline);
    this._refreshCota();

    this.startNavigation();
  }

  _finishRun() {
    const session = storage.get('trailSession') || {};
    session.completedAt = Date.now();
    storage.set('trailSession', session);
    storage.set('navigationStarted', false);
    if (this.demo && this.demo.destroy) this.demo.destroy();
    if (this.nav) this.nav.stop();
    this.showCumbre();
  }

  // Pantalla 05 · Cumbre: el resultado del recorrido (§13).
  // Su CTA abre FinalizacionView (pantalla 06, §14).
  showCumbre() {
    this._clearScreenHost();
    this.screen = 'cumbre';

    const session = storage.get('trailSession') || {};
    const elapsedMin = session.startedAt ? Math.round((Date.now() - session.startedAt) / 60000) : null;

    const screen = document.createElement('div');
    screen.className = 'screen';
    this._screenHost.appendChild(screen);

    this.cumbreView = new CumbreView(screen, {
      trail: this.trail,
      stations: this.stations,
      photo: PHOTOS.completion,
      session: { ...session, elapsedMin },
      onFinalize: () => this.showFinalizacion()
    });
    this.cumbreView.mount();

    this.bottomNavBar.setActive('cumbre');
    this.topAppBar.setOffline(!this._connectionOnline);
  }

  // Pantalla 06 · Finalización: cierre de la experiencia (§14) —
  // resumen, GPX, guía de regreso y vuelta al inicio.
  showFinalizacion() {
    this._clearScreenHost();
    this.screen = 'finalize';

    const session = storage.get('trailSession') || {};
    const elapsedMin = session.startedAt ? Math.round((Date.now() - session.startedAt) / 60000) : null;

    const screen = document.createElement('div');
    screen.className = 'screen';
    this._screenHost.appendChild(screen);

    this.finalizacionView = new FinalizacionView(screen, {
      trail: this.trail,
      route: this.route,
      stations: this.stations,
      safety: this.safety || {},
      session: { ...session, elapsedMin },
      onBack: () => this.showOperationalStart()
    });
    this.finalizacionView.mount();

    this.bottomNavBar.setActive('cumbre');
    this.topAppBar.setOffline(!this._connectionOnline);
  }

  openScanner() {
    if (this.overlay === 'qr') return;
    const overlayEl = document.createElement('div');
    overlayEl.className = 'overlay-host';
    this.root.appendChild(overlayEl);
    this.overlay = 'qr';

    this.qrScanner = new QrScannerModal(overlayEl, {
      onDecode: (stationId) => {
        this.closeOverlay();
        const { station, error } = this.stationMgr.resolveParam(stationId);
        if (error) {
          this._showNotice(error);
          return;
        }
        this.openStation(station, true);
      },
      onClose: () => this.closeOverlay()
    });
    this.qrScanner.open();
  }

  _onStationParam(value) {
    if (!value) return;
    if (!this.stationMgr) {
      this._showNotice('No encontramos esta estación.');
      return;
    }
    const { station, error } = this.stationMgr.resolveParam(value);
    if (error) {
      this._showNotice(error);
      return;
    }
    this.openStation(station, true);
  }

  _openStationById(id) {
    if (!id) return;
    const station = this.stationMgr && this.stationMgr.getById(id);
    if (station) this.openStation(station, false);
  }

  openStation(station, detectedByQr = false) {
    // S0: su ficha es el inicio operacional unificado (pantalla 01).
    // Nunca reinicia el recorrido: GPS, progreso y estación siguen su curso.
    if (station && station.type === 'start') {
      history.replaceState({}, document.title, window.location.pathname);
      this.showOperationalStart();
      return;
    }
    if (this.overlay === 'station' && this.stationOverlay) this.closeOverlay();

    const overlayEl = document.createElement('div');
    overlayEl.className = 'overlay-host';
    this.root.appendChild(overlayEl);
    this.overlay = 'station';

    this.stationOverlay = new StationOverlay(overlayEl, {
      onContinue: () => {
        storage.set('lastStation', station.id);
        if (this.screen === 'cumbre' || this.screen === 'finalize') return this.closeOverlay();
        if ((station.routeProgress || 0) >= COMPLETION_THRESHOLD && station.type === 'viewpoint') {
          return this.closeOverlay() || this._finishRun();
        }
        this.closeOverlay();
      },
      onClose: () => this.closeOverlay()
    });
    // Contexto para la ficha: estación siguiente, avance y último clima
    const snap = this.progress ? this.progress.snapshot() : { progress: 0 };
    const next = station.routeProgress != null ? this.stationMgr.nextStation(station.routeProgress) : null;
    this.stationOverlay.open(station, detectedByQr, {
      next,
      progress: snap.progress,
      weather: this.weatherState || (this.weather ? this.weather.state : null),
      trail: this.trail,
      all: this.stations,
      index: this.stations.findIndex((s) => s.id === station.id)
    });

    // Clean URL without reload
    history.replaceState({}, document.title, window.location.pathname);
  }

  _hasAcceptedLegal() {
    const accepted = storage.get('legalAccepted');
    return accepted && accepted.version === LEGAL_VERSION;
  }

  openLegal({ requireAcceptance = false, onAccept } = {}) {
    if (this.overlay === 'legal') return;

    const overlayEl = document.createElement('div');
    overlayEl.className = 'overlay-host';
    this.root.appendChild(overlayEl);
    this.overlay = 'legal';

    this.legalModal = new LegalModal(overlayEl, {
      requireAcceptance,
      onAccept: (record) => {
        if (requireAcceptance) storage.set('legalAccepted', record);
        this.closeOverlay();
        if (onAccept) onAccept();
      },
      onClose: () => {
        this.legalModal = null;
        this.closeOverlay();
      }
    });
    this.legalModal.open();
  }

  openSafety() {
    if (this.overlay === 'safety') return;

    const overlayEl = document.createElement('div');
    overlayEl.className = 'overlay-host';
    this.root.appendChild(overlayEl);

    document.body.classList.add('is-overlayed');

    const data = this.safety || {
      generalWarning: '',
      recommendations: [],
      emergencyContact: null
    };
    const recs = (data.recommendations || [])
      .map((r) => `<li>${format.escapeHtml(r)}</li>`)
      .join('');
    const contactHtml = data.emergencyContact
      ? `<p class="safety-overlay__contact"><b>Emergencias:</b> ${format.escapeHtml(data.emergencyContact)}</p>`
      : '<p class="safety-overlay__contact safety-overlay__contact--pending"><b>Contacto de emergencia:</b> pendiente de administración del camping. La app no es un sistema de rescate.</p>';

    overlayEl.innerHTML = `
      <div class="safety-overlay" role="dialog" aria-modal="true" aria-label="Seguridad">
        <div class="safety-overlay__backdrop" data-role="backdrop"></div>
        <div class="safety-overlay__sheet">
          <header class="safety-overlay__header">
             <h2>Información y seguridad</h2>
          </header>
          <div class="safety-overlay__body">
            <p class="safety-overlay__warning">${format.escapeHtml(data.generalWarning || '')}</p>
            ${recs ? `<ul class="safety-overlay__list">${recs}</ul>` : ''}
            ${contactHtml}
          </div>
          <button type="button" class="btn btn-primary safety-overlay__close" data-role="close">Cerrar</button>
        </div>
      </div>
    `;

    overlayEl.querySelector('[data-role="backdrop"]').addEventListener('click', () => this.closeOverlay());
    overlayEl.querySelector('[data-role="close"]').addEventListener('click', () => this.closeOverlay());
    this.overlay = 'safety';
  }

  closeOverlay() {
    if (this.legalModal) {
      this.legalModal.destroy();
      this.legalModal = null;
    }
    const overlays = this.root.querySelectorAll('.overlay-host');
    overlays.forEach(l => l.remove());
    document.body.classList.remove('is-overlayed');
    this.stationOverlay = null;
    this.qrScanner = null;
    this.overlay = null;
  }

  _clearScreenHost() {
    this.closeOverlay();
    this._setGpsMode(false);
    this._screenHost.innerHTML = '';
    this._followedOnce = false;
    if (this.navView) {
      this.navView.destroy();
      this.navView = null;
    }
    if (this.mapView) {
      this.mapView.destroy();
      this.mapView = null;
    }
    this.introView = null;
    this.screen = null;
  }

  /* ---------- Navegación ---------- */

  _retakeNavigation() {
    if (this.nav && this.nav.acknowledgeOffRoute) this.nav.acknowledgeOffRoute();
  }

  _exitNavigation() {
    if (this.nav) this.nav.stop();
    this.navRunning = false;
    storage.set('navigationStarted', false);
    this.showOperationalStart();
  }

  _setNavigationRunning(running) {
    this.navRunning = running;
    if (running) {
      storage.set('navigationStarted', true);
      // Sello S0 "Huella Calibrada": se gana al enganchar la navegación GPS
      // (decisión de spec — la cumbre exige 4/4 y la ficha S0 nunca se abre).
      saveStamp('S0');
      if (!storage.get('trailSession')) {
        storage.set('trailSession', { startedAt: Date.now() });
      }
      if (this.demoMode) {
        this.nav.beginSearch();
      } else {
        this.nav.start();
      }
    } else {
      storage.set('navigationStarted', false);
      this.nav.stop();
    }
    if (this.navView) {
      this.navView.renderControls(running);
      if (!running) this.navView.setStatus({ status: 'stopped' });
    }
  }

  _onPosition(position) {
    this.lastPosition = position;
    if (this.navView) {
      this.navView.setPosition(position);
      if (!this._followedOnce) {
        this.navView.centerOn(position);
        this._followedOnce = true;
      }
    }
    if (this.mapView && this.screen === 'map') {
      this.mapView.setPosition(position);
    }
    if (this.progress) this.progress.update(position);
    this._refreshCota();
  }

  _onProgress(snap) {
    storage.set('lastProgress', { progress: snap.progress, updatedAt: Date.now() });
    if (!this.navView) return;
    const next = this.stationMgr.nextStation(snap.progress);
    this.navView.setProgress(snap, next);

    if (snap.progress >= COMPLETION_THRESHOLD && this.screen === 'navigation' && !this._completed) {
      this._completed = true;
      this._finishRun();
    }
    this._refreshCota();
  }

  _onNavStatus({ status, message, accuracy }) {
    if (!this.navView) return;
    this.navView.setStatus({ status, message, accuracy });
    if (status === 'no-permission') {
      this.navRunning = false;
      this.navView.renderControls(false);
    }
  }

  _onConnection(online) {
    this._connectionOnline = online;
    if (!online) {
      this._showNotice('Sin conexión: estás viendo los contenidos que ya estaban descargados.');
    }
    this.topAppBar?.setOffline(!online);
  }

  _showNotice(message) {
    this.notice = message;
    this._renderNotice(message);
  }

  _renderNotice(message) {
    if (!message) return;
    let el = this.root.querySelector('[data-role="notice"]');
    if (!el) {
      el = document.createElement('div');
      el.className = 'app-notice';
      el.setAttribute('data-role', 'notice');
      this.root.prepend(el);
    }
    el.textContent = message;
  }

  _renderFatal() {
    this.root.innerHTML = `
      <div class="app-fatal">
        <h1>Los Saltos de Newenko</h1>
        <p>La experiencia no pudo cargar correctamente. Verificá tu conexión y volvé a intentar.</p>
      </div>
    `;
  }
}

const init = () => {
  new App().boot();
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}