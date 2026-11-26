import { el } from '../../utils/dom.js';

// Top bar: logo + build-server status (checking / ready / SDK missing / offline).
export function AppHeader(store) {
  const root = el(`
    <header class="app-header">
      <div class="app-header-inner">
        <div class="brand">
          <div class="brand-mark">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7l3.5 11L12 10l4.5 8L20 7"/></svg>
          </div>
          <div class="brand-text"><b>Web2APK</b><small>Website to Android app</small></div>
        </div>
        <div class="server-status" data-state="checking"><span class="server-dot"></span><span class="server-text">Checking build tools…</span></div>
      </div>
    </header>`);

  const status = root.querySelector('.server-status');
  const text = root.querySelector('.server-text');

  const render = ({ server }) => {
    let state = 'checking', label = 'Checking build tools…';
    if (server.checked) {
      if (!server.online) { state = 'error'; label = 'Build server offline'; }
      else if (!server.sdk) { state = 'error'; label = 'Android SDK not found'; }
      else { state = 'ok'; label = 'Ready to build'; }
    }
    status.dataset.state = state;
    text.textContent = label;
  };
  store.subscribe(render);
  render(store.get());
  return root;
}
