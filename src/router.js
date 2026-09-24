export class Router {
  constructor(handlers = {}) {
    this.onStation = handlers.onStation || (() => {});
    this.onRefresh = () => this.dispatch(false);
    window.addEventListener('popstate', this.onRefresh);
  }

  stationParam() {
    const params = new URLSearchParams(window.location.search);
    return params.get('station');
  }

  dispatch(updateUrl = true) {
    const value = this.stationParam();
    if (value && updateUrl) {
      const url = new URL(window.location.href);
      url.searchParams.delete('station');
      history.replaceState(null, '', url.toString());
    }
    this.onStation(value);
  }

  destroy() {
    window.removeEventListener('popstate', this.onRefresh);
  }
}