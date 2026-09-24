// ============================================================
// ProgressCard — «Expedition Progress Card» de la pantalla 03
// (navegación GPS activa). Copy del mockup v2: progreso del
// tramo, métricas recorrido/total y próximo hito con ETA de
// marcha (3.5 km/h), perfil real con marcador y pendiente.
// ============================================================
import { format } from '../utils/format.js';
import { elevationSvg } from './ElevationProfile.js';
import { elevation } from '../utils/elevation.js';

const nf = (n) => (Number.isFinite(n) ? Math.round(n).toLocaleString('es-AR') : '—');

const WALK_SPEED_KMH = 3.5; // ritmo de marcha en sendero de montaña (ETA)

export class ProgressCard {
  constructor(container, options = {}) {
    this.container = container;
    this.onOpenStation = options.onOpenStation || (() => {});
    this.profile = options.profile || null;
    this.trail = options.trail || {};
    this.stations = options.stations || [];
    this._nextStationId = null;
    this._progress = null;
  }

  mount() {
    const total = Number(this.trail.distanceMeters);

    this.container.innerHTML = `
      <div class="progress-card sheet">
        <div class="progress-card__head">
          <span class="progress-card__kicker">Progreso del tramo</span>
          <span class="progress-card__status" data-role="status">Iniciando recorrido…</span>
        </div>
        <div class="progress-card__titlerow">
          <strong class="progress-card__pct" data-role="pct">0%</strong>
        </div>
        <div class="progress-card__gauge" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" aria-label="Progreso del tramo" data-role="gauge">
          <div class="progress-card__gauge-bg"></div>
          <div class="progress-card__gauge-fill" data-role="fill" style="width:0%"></div>
        </div>
        <div class="progress-card__metrics">
          <div class="progress-card__metric">
            <span class="material-symbols-outlined" aria-hidden="true">route</span>
            <div>
              <span class="progress-card__metric-label">Recorrido / total</span>
              <strong data-role="dist">0 m / ${format.formatDistance(total)}</strong>
            </div>
          </div>
          <button type="button" class="progress-card__metric progress-card__metric--next" data-role="next" hidden>
            <span class="material-symbols-outlined" aria-hidden="true">schedule</span>
            <div>
              <span class="progress-card__metric-label" data-role="next-label">Próx. hito</span>
              <strong data-role="next-value">—</strong>
            </div>
          </button>
        </div>
        <div class="progress-card__profile-head">
          <span class="progress-card__profile-title"><span class="material-symbols-outlined" aria-hidden="true">show_chart</span> Perfil de elevación</span>
          <span class="progress-card__grade" data-role="grade">Pendiente actual: —</span>
        </div>
        <div class="progress-card__profile" data-role="profile"></div>
      </div>
    `;

    this._els = {
      status: this.container.querySelector('[data-role="status"]'),
      pct: this.container.querySelector('[data-role="pct"]'),
      gauge: this.container.querySelector('[data-role="gauge"]'),
      fill: this.container.querySelector('[data-role="fill"]'),
      dist: this.container.querySelector('[data-role="dist"]'),
      next: this.container.querySelector('[data-role="next"]'),
      nextLabel: this.container.querySelector('[data-role="next-label"]'),
      nextValue: this.container.querySelector('[data-role="next-value"]'),
      grade: this.container.querySelector('[data-role="grade"]'),
      profile: this.container.querySelector('[data-role="profile"]')
    };

    this._els.next.addEventListener('click', () => {
      if (this._nextStationId) this.onOpenStation(this._nextStationId);
    });

    this._renderProfile(0);
  }

  update(progress) {
    if (!this._els) return;
    this._progress = progress;
    const p = Number(progress.progress) || 0;
    const pct = Math.round(progress.progressPercentage);

    this._els.pct.textContent = `${pct}%`;
    this._els.gauge.setAttribute('aria-valuenow', String(pct));
    this._els.fill.style.width = `${pct}%`;
    this._els.dist.textContent = `${format.formatDistance(progress.traveled)} / ${format.formatDistance(Number(this.trail.distanceMeters))}`;

    if (pct >= 100) {
      this._els.status.textContent = '¡Cumbre alcanzada!';
    } else if (pct > 0) {
      this._els.status.textContent = 'En marcha';
    }

    // Pendiente actual desde el modelo altimétrico (data/, sin GPS)
    const grade = this.profile && this.profile.gradeAt ? this.profile.gradeAt(p) : null;
    this._els.grade.textContent = `Pendiente actual: ${format.formatGrade(grade)}`;

    this._renderProfile(p);
  }

  setNextStation(station, distanceTo = null) {
    if (!this._els) return;
    if (!station) {
      this._els.next.hidden = true;
      this._nextStationId = null;
      return;
    }
    this._nextStationId = station.id;
    this._els.nextLabel.textContent = `Próx. hito (${station.id})`;
    this._els.nextValue.textContent =
      distanceTo != null && Number.isFinite(distanceTo)
        ? `${format.formatDistance(distanceTo)} (${format.formatEta(distanceTo, WALK_SPEED_KMH)})`
        : format.escapeHtml(station.name);
    this._els.next.hidden = false;
  }

  // SVG compartido con marcador de avance y etiquetas S0…S3
  _renderProfile(progress) {
    if (!this._els.profile) return;
    if (!this.profile) {
      this._els.profile.innerHTML = '<p class="elevation-svg elevation-svg--empty">Perfil altimétrico no disponible.</p>';
      return;
    }
    const first = this.stations[0];
    const last = this.stations[this.stations.length - 1];
    const axisLabels = [];
    if (first) {
      const cota = elevation.parseCota(first.cota);
      axisLabels.push({ p: 0, text: `${first.id} (${nf(cota)}m)` });
    }
    if (last) {
      const cota = elevation.parseCota(last.cota);
      axisLabels.push({ p: 1, text: `${last.id} (${nf(cota)}m)` });
    }
    this._els.profile.innerHTML = elevationSvg(this.profile, {
      height: 72,
      compact: true,
      axisLabels,
      markerProgress: progress,
      label: 'Perfil de elevación del tramo'
    });
  }
}
