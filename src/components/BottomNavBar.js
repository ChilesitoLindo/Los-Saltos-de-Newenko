export class BottomNavBar {
  constructor(container, options = {}) {
    this.container = container;
    this.options = options;
    this.activeTab = options.activeTab || 'inicio';
  }

  mount() {
    const tabs = [
      { id: 'inicio', label: 'Inicio', icon: 'landscape' },
      { id: 'mapa', label: 'Mapa', icon: 'map' },
      { id: 'gps', label: 'GPS', icon: 'navigation' },
      { id: 'qr', label: 'QR', icon: 'qr_code_scanner' },
      { id: 'cumbre', label: 'Cumbre', icon: 'flag' }
    ];

    this.container.innerHTML = `
      <nav class="bottombar" role="navigation" aria-label="Navegación principal">
        ${tabs.map(t => `
          <button type="button" class="bottombar__tab ${t.id === this.activeTab ? 'bottombar__tab--active' : ''}" data-tab="${t.id}" aria-current="${t.id === this.activeTab ? 'page' : 'false'}">
            <span class="material-symbols-outlined bottombar__icon">${t.icon}</span>
            <span class="bottombar__label">${t.label}</span>
          </button>
        `).join('')}
      </nav>
    `;

    this.container.querySelectorAll('[data-tab]').forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.getAttribute('data-tab');
        this.setActive(tab);
        if (this.options.onTab) this.options.onTab(tab);
      });
    });
  }

  setActive(tabId) {
    this.activeTab = tabId;
    this.container.querySelectorAll('[data-tab]').forEach(btn => {
      const isActive = btn.getAttribute('data-tab') === tabId;
      btn.classList.toggle('bottombar__tab--active', isActive);
      btn.setAttribute('aria-current', isActive ? 'page' : 'false');
    });
  }
}