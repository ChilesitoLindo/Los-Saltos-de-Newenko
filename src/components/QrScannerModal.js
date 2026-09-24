const LIB_PATH = 'assets/vendor/jsqr.js';

let libPromise = null;

function loadLib() {
  if (typeof window.jsQR === 'function') return Promise.resolve();
  if (libPromise) return libPromise;
  libPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = LIB_PATH;
    script.async = true;
    script.onload = () => (typeof window.jsQR === 'function' ? resolve() : reject(new Error('jsqr')));
    script.onerror = () => reject(new Error('load'));
    document.head.appendChild(script);
  });
  return libPromise;
}

function extractStation(url) {
  if (!url) return null;
  try {
    const params = new URLSearchParams(String(url).split('?')[1] || '');
    const value = params.get('station');
    return value || null;
  } catch {
    return null;
  }
}

export class QrScannerModal {
  constructor(container, options = {}) {
    this.container = container;
    this.options = options;
    this._stream = null;
    this._raf = null;
    this._video = null;
    this._canvas = null;
    this._started = false;
  }

  open() {
    this.container.innerHTML = `
      <div class="qr-scanner-modal" role="dialog" aria-modal="true" aria-label="Escáner de código QR">
        <div class="qr-scanner-modal__backdrop" data-role="backdrop"></div>
        <div class="qr-scanner-modal__sheet">
          <header class="qr-scanner-modal__header">
            <h2>Escaneá el código QR de la estación</h2>
            <button type="button" class="qr-scanner-modal__close" data-role="close" aria-label="Cerrar escáner">
              <span class="material-symbols-outlined">close</span>
            </button>
          </header>
          <div class="qr-scanner-modal__viewport">
            <video data-role="video" muted playsinline></video>
            <div class="qr-scanner-modal__frame" aria-hidden="true">
              <div class="qr-scanner-modal__frame-corner"></div>
              <div class="qr-scanner-modal__frame-corner"></div>
              <div class="qr-scanner-modal__frame-corner"></div>
              <div class="qr-scanner-modal__frame-corner"></div>
            </div>
            <p class="qr-scanner-modal__status" data-role="status">Preparando cámara…</p>
          </div>
          <p class="qr-scanner-modal__note">Apuntá la cámara al código del poste. Escanear una estación nunca reinicia tu recorrido.</p>
          <div class="qr-scanner-modal__error" data-role="error" hidden></div>
        </div>
      </div>
    `;

    this._video = this.container.querySelector('[data-role="video"]');
    this._status = this.container.querySelector('[data-role="status"]');
    this._error = this.container.querySelector('[data-role="error"]');
    this._canvas = document.createElement('canvas');
    this._canvasCtx = this._canvas.getContext('2d', { willReadFrequently: true });

    this.container.querySelector('[data-role="backdrop"]').addEventListener('click', () => this.close());
    this.container.querySelector('[data-role="close"]').addEventListener('click', () => this.close());

    this.container.classList.add('qr-scanner-modal--open');
    document.body.classList.add('is-overlayed');
    this._start();
  }

  close() {
    if (this._raf) cancelAnimationFrame(this._raf);
    this._raf = null;
    if (this._stream) {
      this._stream.getTracks().forEach(t => t.stop());
      this._stream = null;
    }
    if (this._started && this._video) this._video.srcObject = null;
    this.container.classList.remove('qr-scanner-modal--open');
    document.body.classList.remove('is-overlayed');
    this.container.innerHTML = '';
    if (this.options.onClose) this.options.onClose();
  }

  async _start() {
    try {
      await loadLib();
    } catch {
      this._fail('La lectura de QR no pudo cargarse. Escaneá el cartel con la cámara del teléfono.');
      return;
    }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      this._fail('Tu navegador no permite acceder a la cámara desde esta conexión.');
      return;
    }
    try {
      this._stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false
      });
    } catch {
      this._fail('No pudimos acceder a la cámara. Revisá el permiso del navegador.');
      return;
    }
    this._started = true;
    this._video.srcObject = this._stream;
    await this._video.play().catch(() => {});
    this._status.textContent = 'Apuntá la cámara al código del poste.';
    this._loop();
  }

  _loop() {
    const { videoWidth: w, videoHeight: h } = this._video;
    if (w > 0 && h > 0) {
      this._canvas.width = w;
      this._canvas.height = h;
      this._canvasCtx.drawImage(this._video, 0, 0, w, h);
      const imageData = this._canvasCtx.getImageData(0, 0, w, h);
      const code = window.jsQR(imageData.data, w, h, { inversionAttempts: 'dontInvert' });
      if (code && code.data) {
        const parsed = this._tryParse(code.data);
        if (parsed) {
          this.close();
          if (this.options.onDecode) this.options.onDecode(parsed);
          return;
        }
      }
    }
    this._raf = requestAnimationFrame(() => this._loop());
  }

  _tryParse(data) {
    const station = extractStation(data);
    if (station) return station;
    const direct = /S[0-9]+/i.exec(String(data));
    return direct ? direct[0].toUpperCase() : null;
  }

  _fail(message) {
    this._error.hidden = false;
    this._error.textContent = message;
    if (this._status) this._status.textContent = '';
  }
}