import { loadData } from '../utils/loader.js';

export class SafetyManager {
  constructor(config = {}) {
    this.dataPath = config.dataPath || 'data/safety.json';
    this.data = null;
    this.status = 'loading';
    this.message = '';
  }

  async load() {
    try {
      const res = await loadData(this.dataPath);
      if (!res.ok) throw new Error('http');
      this.data = await res.json();
      this.status = 'ready';
      return this.data;
    } catch {
      this.status = 'error';
      this.data = null;
      this.message = 'La información de seguridad no está disponible por ahora.';
      return null;
    }
  }

  get offRouteMessage() {
    if (this.data && this.data.offRouteMessage) return this.data.offRouteMessage;
    return 'Parece que te has alejado del sendero. Revisa el mapa para volver al recorrido marcado.';
  }
}