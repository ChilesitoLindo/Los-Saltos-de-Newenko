export class OfflineManager {
  init() {
    if (!('serviceWorker' in navigator)) {
      return { supported: false };
    }
    if (!['http:', 'https:'].includes(window.location.protocol)) {
      return { supported: false };
    }
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch(() => {
        // registro opcional: si falla, la app sigue funcionando online
      });
    });
    return { supported: true };
  }

  get isOnline() {
    return navigator.onLine;
  }

  onConnectionChange(handler) {
    window.addEventListener('online', () => handler(true));
    window.addEventListener('offline', () => handler(false));
  }
}