import { format } from '../utils/format.js';
import { elevationSvg } from './ElevationProfile.js';
import { STATION_COLORS } from './MapView.js';

const WALK_SPEED_KMH = 3.5;

const asProgress = (value) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.min(1, number));
};

export class ProgressCard {
  constructor(container, options = {}) {
    this.container = container;
    this.onOpenStation = options.onOpenStation || (() => {});
    this.profile = options.profile || null;
    this.trail = options.trail || {};
    this.stations = Array.isArray(options.stations) ? options.stations : [];
    this._els = null;
    this._segments = [];
    this._nextStation = null;
  }

  mount() {
    this.container.innerHTML = `
      <div class="gps-hud" data-role="gps-hud">
        <div class="gps-progress-strip" data-role="progress-strip" role="progressbar" aria-label="Progreso del recorrido" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"></div>
        <div class="gps-next gps-glass" data-role="next-card">
          <div class="gps-next__pins" data-role="next-pins" aria-hidden="true"></div>
          <div class="gps-next__copy">
            <strong data-role="next-name">—</strong>
            <span data-role="next-meta">Preparando próximo hito</span>
          </div>
          <div class="gps-next__stats">
            <strong data-role="next-distance">—</strong>
            <span data-role="next-eta"></span>
          </div>
        </div>
        <div class="gps-cota" data-role="cota" hidden>
          <span data-role="cota-value">—</span>
          <span class="gps-cota__separator">·</span>
          <span class="gps-cota__delta" data-role="delta"></span>
        </div>
        <button type="button" class="gps-terrain" data-role="terrain" hidden>
          <span class="material-symbols-outlined" aria-hidden="true">terrain</span>
          <span data-role="terrain-text"></span>
        </button>
        <section class="gps-spark gps-glass" data-role="profile-card">
          <button type="button" class="gps-spark__handle" data-role="profile-toggle" aria-expanded="false" aria-controls="gps-profile-body">
            <span class="material-symbols-outlined" aria-hidden="true">show_chart</span>
            <span>Perfil de elevación</span>
            <span class="material-symbols-outlined gps-spark__chevron" aria-hidden="true">expand_more</span>
          </button>
          <div class="gps-spark__body" id="gps-profile-body" data-role="profile-body" hidden>
            <div class="gps-spark__chart" data-role="profile"></div>
            <div class="gps-spark__meta">
              <span data-role="profile-cota">Cota —</span>
              <span data-role="profile-range">Rango —</span>
              <span class="gps-spark__grade">▲ <b data-role="profile-grade">—</b></span>
            </div>
          </div>
        </section>
      </div>
    `;

    this._els = {
      strip: this.container.querySelector('[data-role="progress-strip"]'),
      nextCard: this.container.querySelector('[data-role="next-card"]'),
      nextPins: this.container.querySelector('[data-role="next-pins"]'),
      nextName: this.container.querySelector('[data-role="next-name"]'),
      nextMeta: this.container.querySelector('[data-role="next-meta"]'),
      nextDistance: this.container.querySelector('[data-role="next-distance"]'),
      nextEta: this.container.querySelector('[data-role="next-eta"]'),
      cota: this.container.querySelector('[data-role="cota"]'),
      cotaValue: this.container.querySelector('[data-role="cota-value"]'),
      delta: this.container.querySelector('[data-role="delta"]'),
      terrain: this.container.querySelector('[data-role="terrain"]'),
      terrainText: this.container.querySelector('[data-role="terrain-text"]'),
      profileCard: this.container.querySelector('[data-role="profile-card"]'),
      profileToggle: this.container.querySelector('[data-role="profile-toggle"]'),
      profileBody: this.container.querySelector('[data-role="profile-body"]'),
      profile: this.container.querySelector('[data-role="profile"]'),
      profileCota: this.container.querySelector('[data-role="profile-cota"]'),
      profileRange: this.container.querySelector('[data-role="profile-range"]'),
      profileGrade: this.container.querySelector('[data-role="profile-grade"]')
    };

    this._buildSegments();
    this._els.profileToggle.addEventListener('click', () => this._toggleProfile());
    this._renderProfile(0);
    this.setNextStation(null, 0);
  }

  _buildSegments() {
    const raw = [{ p: 0 }, ...this.stations.map((station) => ({ p: Number(station.routeProgress) })), { p: 1 }]
      .filter((point) => Number.isFinite(point.p))
      .sort((a, b) => a.p - b.p);
    const points = [];
    raw.forEach((point) => {
      const last = points[points.length - 1];
      if (!last || point.p > last.p + 0.0001) points.push(point);
    });
    if (points.length < 2) points.push({ p: 1 });

    this._els.strip.innerHTML = '';
    this._segments = [];
    for (let i = 0; i < points.length - 1; i += 1) {
      const segment = document.createElement('span');
      segment.className = 'gps-progress-strip__segment';
      segment.dataset.start = String(points[i].p);
      segment.dataset.end = String(points[i + 1].p);
      const fill = document.createElement('span');
      fill.className = 'gps-progress-strip__fill';
      fill.style.transform = 'scaleX(0)';
      segment.appendChild(fill);
      this._els.strip.appendChild(segment);
      this._segments.push({ element: segment, fill, start: points[i].p, end: points[i + 1].p });
    }
  }

  update(progress = {}) {
    if (!this._els) return;
    const value = asProgress(progress.progress);
    const percent = Math.round(value * 100);
    this._els.strip.setAttribute('aria-valuenow', String(percent));
    this._segments.forEach((segment) => {
      const amount = value <= segment.start ? 0 : value >= segment.end ? 1 : (value - segment.start) / (segment.end - segment.start);
      segment.fill.style.transform = `scaleX(${amount})`;
      segment.element.classList.toggle('is-active', amount > 0 && amount < 1);
    });
    this._renderProfile(value);
  }

  setNextStation(station, distanceTo = null) {
    if (!this._els) return;
    const next = station || this.stations[this.stations.length - 1] || null;
    this._nextStation = next;
    if (!next) {
      this._els.nextCard.hidden = true;
      this.setTerrain('');
      return;
    }

    const complete = !station;
    const index = this.stations.findIndex((item) => item.id === next.id);
    const start = index < 0 ? 0 : index;
    const pins = this.stations.slice(start).map((item) => {
      const color = STATION_COLORS[item.type] || '#1e3a5f';
      const label = format.escapeHtml(String(item.id || '').replace(/^S/, ''));
      return `<span class="gps-station-mark" style="--station-color:${color}">${label}</span>`;
    }).join('');
    this._els.nextPins.innerHTML = pins;
    this._els.nextName.textContent = complete ? 'Ruta completa' : next.name || 'Próximo hito';
    this._els.nextCard.classList.toggle('is-complete', complete);
    this._els.nextMeta.textContent = complete ? 'Has llegado al último hito' : `A ${format.formatDistance(distanceTo)} · escanea su QR al llegar`;
    this._els.nextDistance.textContent = complete ? '100%' : format.formatDistance(distanceTo);
    this._els.nextEta.textContent = complete ? '' : format.formatEta(distanceTo, WALK_SPEED_KMH) || '';
    this.setTerrain(next.safetyBadge ? `Alerta de terreno · ${next.safetyBadge}` : '');
  }

  setCota(cotaText) {
    if (!this._els) return;
    if (!cotaText) {
      this._els.cota.hidden = true;
      return;
    }
    this._els.cotaValue.textContent = cotaText;
    this._els.cota.hidden = false;
  }

  setDesnivel(deltaText) {
    if (!this._els) return;
    this._els.delta.textContent = deltaText || '';
  }

  setTerrain(text) {
    if (!this._els) return;
    this._els.terrain.hidden = !text;
    if (text) this._els.terrainText.textContent = text;
  }

  _toggleProfile() {
    const open = this._els.profileBody.hidden;
    this._els.profileBody.hidden = !open;
    this._els.profileCard.classList.toggle('is-open', open);
    this._els.profileToggle.setAttribute('aria-expanded', String(open));
  }

  _renderProfile(progress) {
    if (!this._els) return;
    if (!this.profile) {
      this._els.profile.innerHTML = '<p class="elevation-svg elevation-svg--empty">Perfil altimétrico no disponible.</p>';
      return;
    }
    const labels = this.stations
      .filter((station) => Number.isFinite(Number(station.routeProgress)))
      .map((station) => ({ p: Number(station.routeProgress), text: station.id }));
    this._els.profile.innerHTML = elevationSvg(this.profile, {
      height: 74,
      compact: true,
      axisLabels: labels,
      markerProgress: progress,
      label: 'Perfil de elevación del sendero'
    });

    const points = Array.isArray(this.profile.points) ? this.profile.points : [];
    if (!points.length) return;
    const min = Math.min(...points.map((point) => point.cota));
    const max = Math.max(...points.map((point) => point.cota));
    const cota = this.profile.cotaAt ? this.profile.cotaAt(progress) : null;
    const grade = this.profile.gradeAt ? this.profile.gradeAt(progress) : null;
    this._els.profileCota.textContent = Number.isFinite(cota) ? `${Math.round(cota).toLocaleString('es-AR')} msnm` : 'Cota —';
    this._els.profileRange.textContent = `${Math.round(min).toLocaleString('es-AR')}–${Math.round(max).toLocaleString('es-AR')} msnm`;
    this._els.profileGrade.textContent = Number.isFinite(grade) ? format.formatGrade(grade) : '—';
  }
}
