import { escapeHtml } from '../utils/format.js';

export const LEGAL_VERSION = '1.0.0';
const LEGAL_DATE = '24 de septiembre de 2026';

const SUMMARY = [
  'La app es gratuita, voluntaria y no muestra publicidad. No cobra ni crea cuentas de usuario.',
  'Al activar el GPS, el navegador puede entregar lecturas de ubicación para mostrarte en el mapa y calcular tu progreso. La app no guarda esas coordenadas en el almacenamiento local.',
  'El mapa, el clima y otros recursos pueden conectarse a proveedores externos que reciben metadatos técnicos de la conexión.',
  'La app orienta, pero no reemplaza la señalización física, las indicaciones del personal ni de las autoridades.'
];

const SECTIONS = [
  {
    title: '1. Qué es esta aplicación',
    paragraphs: [
      'Los Saltos de Newenko es una herramienta gratuita de orientación e información para visitantes del sendero. Permite consultar el mapa, activar el GPS, seguir el progreso y conocer las estaciones con códigos QR.',
      'La app no cobra por su uso, no muestra publicidad y no crea cuentas. No solicita ni registra datos biométricos.'
    ]
  },
  {
    title: '2. Límites de uso',
    paragraphs: [
      'La app es una guía orientativa y no un sistema de rescate ni de seguridad. La precisión del GPS, la disponibilidad del mapa, el clima y la conectividad dependen del dispositivo, la señal y las condiciones del entorno.',
      'La app no reemplaza la señalización física, las indicaciones del personal del camping ni las instrucciones de las autoridades. Nada de lo indicado en este documento excluye derechos u obligaciones que la ley no permita excluir.'
    ]
  },
  {
    title: '3. Tu ubicación (GPS)',
    paragraphs: [
      'Cuando eliges activar la navegación GPS, el navegador de tu teléfono puede solicitar permiso y entregar lecturas como latitud, longitud, precisión, altitud, velocidad y hora.',
      'La app utiliza esas lecturas en memoria para mostrar tu posición y calcular el progreso. No las guarda como coordenadas en localStorage ni las incluye en la consulta meteorológica. La consulta del clima utiliza el centro del trazado del sendero.',
      'Puedes rechazar o revocar el permiso desde la configuración del navegador o del sistema operativo. Si continúas sin GPS, puedes consultar el mapa general y el contenido de las estaciones que esté disponible, pero algunas funciones pueden requerir conexión.'
    ]
  },
  {
    title: '4. Qué se guarda localmente',
    paragraphs: [
      'La app guarda localmente en el navegador datos de sesión, estaciones, progreso, preferencia de mapa, sellos, última respuesta meteorológica, la fecha y versión de aceptación de estos términos y, si escribes una, una nota del libro de cumbre.',
      'No se crean cuentas y no se solicitan nombre, correo, teléfono ni RUT. La app no sincroniza esos datos con un servidor propio. Los datos permanecen en el navegador hasta que se borran; borrar los datos del sitio es la forma segura de eliminarlos. Desinstalar la PWA puede no borrar el almacenamiento del navegador.',
      'Si compartes un dispositivo o dejas el navegador desbloqueado, otras personas con acceso a ese perfil podrían ver la información local guardada.'
    ]
  },
  {
    title: '5. Servicios externos',
    paragraphs: [
      'La app utiliza Leaflet desde unpkg, mosaicos de OpenStreetMap y Esri, y datos meteorológicos de Open-Meteo. El hosting estático y estos proveedores pueden recibir información técnica de la conexión, como la dirección IP, el navegador, la hora, la URL solicitada y el área del mapa consultada.',
      'La app no incluye publicidad ni un sistema de analítica, pero los proveedores externos mantienen sus propias políticas y pueden registrar la información que reciben para prestar sus servicios.',
      'El escáner de códigos QR puede solicitar permiso de cámara. La app procesa las imágenes localmente para leer el QR; no graba ni sube el video de la cámara.'
    ]
  },
  {
    title: '6. Disponibilidad y funcionamiento',
    paragraphs: [
      'Después de una carga y descarga exitosa, algunos contenidos pueden estar disponibles sin conexión. La cobertura offline no es completa: algunos mosaicos del mapa y el clima actual pueden requerir conexión.',
      'La app puede actualizarse, cambiar sus contenidos o dejar de estar disponible. El uso del sendero sigue siendo voluntario y debe realizarse siguiendo las indicaciones del lugar.'
    ]
  },
  {
    title: '7. Contacto',
    paragraphs: [
      'Para cualquier consulta sobre esta aplicación o para presentar una solicitud relacionada con tus datos, comunícate con la Administración del Camping Los Saltos de Newenko. Puedes acudir al camping o solicitar a la administración el medio de contacto disponible.'
    ]
  },
  {
    title: '8. Aceptación y versión',
    paragraphs: [
      'Al marcar la casilla y continuar, declaras que leíste y aceptas esta versión de los Términos de uso y del aviso de privacidad. Si no estás de acuerdo, puedes dejar de utilizar la app y seguir usando la señalización física y las indicaciones del camping.',
      'La versión vigente se indica al inicio de este documento. Si cambia el texto o su versión, la app solicitará una nueva aceptación.'
    ]
  }
];

const escapeParagraphs = (paragraphs) => paragraphs.map((text) => `<p>${escapeHtml(text)}</p>`).join('');

const escapeList = (items) => `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`;

export class LegalModal {
  constructor(container, options = {}) {
    this.container = container;
    this.options = options;
    this.requireAcceptance = false;
    this.detailsOpen = true;
    this._onKeyDown = null;
  }

  open() {
    this.requireAcceptance = !!this.options.requireAcceptance;
    this.detailsOpen = !this.requireAcceptance;
    this._render();
    document.body.classList.add('is-overlayed');
    this._onKeyDown = (event) => {
      if (event.key === 'Escape' && !this.requireAcceptance) this.close();
    };
    document.addEventListener('keydown', this._onKeyDown);
    requestAnimationFrame(() => {
      const title = this.container.querySelector('#legal-modal-title');
      if (title) title.focus();
    });
  }

  _render() {
    const showClose = !this.requireAcceptance;
    const body = this.detailsOpen ? this._documentHtml() : this._summaryHtml();
    this.container.innerHTML = `
      <div class="legal-modal" role="dialog" aria-modal="true" aria-labelledby="legal-modal-title" aria-describedby="legal-modal-intro">
        <div class="legal-modal__backdrop" data-role="backdrop"></div>
        <section class="legal-modal__sheet">
          <header class="legal-modal__header">
            <div>
              <h2 id="legal-modal-title" tabindex="-1">Términos de uso y aviso de privacidad</h2>
              <p>Versión ${escapeHtml(LEGAL_VERSION)} · ${escapeHtml(LEGAL_DATE)}</p>
            </div>
            ${showClose ? `<button type="button" class="legal-modal__close" data-role="close" aria-label="Cerrar términos"><span class="material-symbols-outlined">close</span></button>` : ''}
          </header>
          <div class="legal-modal__body">${body}</div>
          <footer class="legal-modal__footer">
            ${this.requireAcceptance ? `
              <label class="legal-modal__consent">
                <input type="checkbox" data-role="consent">
                <span>He leído y acepto los Términos de uso y el aviso de privacidad de esta versión.</span>
              </label>
              <button type="button" class="btn btn-primary legal-modal__accept" data-role="accept" disabled>Continuar</button>
            ` : `<button type="button" class="btn btn-secondary legal-modal__close-bottom" data-role="close">Cerrar</button>`}
          </footer>
        </section>
      </div>
    `;
    this._bind();
  }

  _summaryHtml() {
    return `
      <p class="legal-modal__intro" id="legal-modal-intro">Antes de continuar, revisa este resumen. Puedes abrir el documento completo sin dejar la pantalla de bienvenida.</p>
      ${escapeList(SUMMARY)}
      <button type="button" class="legal-modal__read" data-role="read-full">Leer términos y aviso de privacidad completos</button>
    `;
  }

  _documentHtml() {
    const sections = SECTIONS.map((section) => `
      <section class="legal-modal__section">
        <h3>${escapeHtml(section.title)}</h3>
        ${escapeParagraphs(section.paragraphs)}
      </section>
    `).join('');
    return `
      <p class="legal-modal__intro" id="legal-modal-intro">Este documento describe el funcionamiento de la app en esta versión. El canal de contacto indicado es la Administración del Camping Los Saltos de Newenko.</p>
      ${this.requireAcceptance ? `<button type="button" class="legal-modal__read" data-role="back-summary">Volver al resumen</button>` : ''}
      ${sections}
    `;
  }

  _bind() {
    const backdrop = this.container.querySelector('[data-role="backdrop"]');
    if (backdrop) {
      backdrop.addEventListener('click', () => {
        if (!this.requireAcceptance) this.close();
      });
    }

    this.container.querySelectorAll('[data-role="close"]').forEach((button) => {
      button.addEventListener('click', () => this.close());
    });

    const readFull = this.container.querySelector('[data-role="read-full"]');
    if (readFull) {
      readFull.addEventListener('click', () => {
        this.detailsOpen = true;
        this._render();
      });
    }

    const backSummary = this.container.querySelector('[data-role="back-summary"]');
    if (backSummary) {
      backSummary.addEventListener('click', () => {
        this.detailsOpen = false;
        this._render();
      });
    }

    const consent = this.container.querySelector('[data-role="consent"]');
    const accept = this.container.querySelector('[data-role="accept"]');
    if (consent && accept) {
      consent.addEventListener('change', () => {
        accept.disabled = !consent.checked;
      });
      accept.addEventListener('click', () => {
        if (!consent.checked) return;
        if (this.options.onAccept) this.options.onAccept({ version: LEGAL_VERSION, acceptedAt: Date.now() });
      });
    }
  }

  close() {
    if (this.requireAcceptance) return;
    this.destroy();
    if (this.options.onClose) this.options.onClose();
  }

  destroy() {
    if (this._onKeyDown) {
      document.removeEventListener('keydown', this._onKeyDown);
      this._onKeyDown = null;
    }
    this.container.innerHTML = '';
    document.body.classList.remove('is-overlayed');
  }
}
