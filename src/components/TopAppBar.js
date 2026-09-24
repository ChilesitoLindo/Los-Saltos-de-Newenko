export class TopAppBar {
  constructor(container, options = {}) {
    this.container = container;
    this.options = options;
    this.offline = false;
  }

  mount() {
    this.container.innerHTML = `
      <header class="topappbar" role="banner">
        <div class="topappbar__brand">
          <img class="topappbar__isotipo" src="assets/logo/isotipo-newenko.png" alt="" aria-hidden="true">
          <div class="topappbar__titles">
            <h1 class="topappbar__title">Los Saltos de Newenko</h1>
            <span class="topappbar__subtitle">Sendero Interactivo · Camping Loncopangue</span>
          </div>
        </div>
        <div class="topappbar__actions">
          <span class="topappbar__cota" data-role="cota" hidden></span>
          <span class="topappbar__offline-chip" data-role="offline" hidden>Modo expedición · Sin conexión</span>
          <button class="topappbar__safety" data-role="safety" aria-label="Información de seguridad">
            <span class="material-symbols-outlined">shield</span>
          </button>
        </div>
      </header>
    `;
    this._offlineEl = this.container.querySelector('[data-role="offline"]');
    this._cotaEl = this.container.querySelector('[data-role="cota"]');
    this.container.querySelector('[data-role="safety"]').addEventListener('click', () => {
      if (this.options.onSafety) this.options.onSafety();
    });
  }

  setOffline(isOffline) {
    this.offline = isOffline;
    if (this._offlineEl) this._offlineEl.hidden = !isOffline;
  }

  setCota(cotaText) {
    if (!this._cotaEl) return;
    if (!cotaText) {
      this._cotaEl.hidden = true;
      return;
    }
    this._cotaEl.textContent = `▲ ${cotaText}`;
    this._cotaEl.hidden = false;
  }
}