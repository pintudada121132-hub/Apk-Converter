import { el } from '../../utils/dom.js';
import { icon } from '../../utils/icons.js';
import { onColor } from '../../utils/color.js';

// Live preview of the website inside a phone frame (portrait / landscape / desktop view).
const VIEWS = [
  ['portrait', 'phone', 'Portrait'],
  ['landscape', 'phoneLandscape', 'Landscape'],
  ['desktop', 'desktop', 'Desktop'],
];

export function PhonePreview(store) {
  const root = el(`
    <section class="card phone-preview">
      <div class="card-head"><span class="card-titles"><span class="card-title">Live preview</span><span class="card-subtitle">Roughly how the app will look</span></span></div>
      <div class="card-body">
        <div class="segmented" role="group" aria-label="Preview mode">
          ${VIEWS.map(([k, i, t]) => `<button type="button" data-view="${k}">${icon(i, 14)}${t}</button>`).join('')}
        </div>
        <div class="phone-stage">
          <div class="phone-device">
            <div class="phone-screen">
              <div class="phone-statusbar"><span>9:41</span><span class="phone-camera"></span><span class="phone-sys">
                <svg width="14" height="10" viewBox="0 0 16 12" fill="currentColor"><rect x="0" y="8" width="3" height="4" rx="1"/><rect x="4.3" y="5.5" width="3" height="6.5" rx="1"/><rect x="8.6" y="3" width="3" height="9" rx="1"/><rect x="12.9" y="0" width="3" height="12" rx="1"/></svg>
                <svg width="20" height="10" viewBox="0 0 24 12" fill="none" stroke="currentColor" stroke-width="1.4"><rect x="1" y="1" width="19" height="10" rx="2.5"/><rect x="3" y="3" width="15" height="6" rx="1" fill="currentColor"/><path d="M22 4.5v3"/></svg>
              </span></div>
              <iframe class="phone-frame" title="Website preview" referrerpolicy="no-referrer" sandbox="allow-scripts allow-same-origin allow-forms"></iframe>
              <div class="phone-empty">${icon('globe', 40, 1.5)}<b>No preview yet</b><span>Enter a website link and press Preview</span></div>
              <div class="phone-loading" hidden><span class="spinner dark"></span></div>
              <div class="phone-fab"><svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg></div>
            </div>
          </div>
        </div>
        <p class="phone-note">${icon('info', 14)}<span>Some websites block previews like this. They still work normally in the app.</span></p>
      </div>
    </section>`);

  const stage = root.querySelector('.phone-stage');
  const device = root.querySelector('.phone-device');
  const frame = root.querySelector('.phone-frame');
  const statusbar = root.querySelector('.phone-statusbar');
  const empty = root.querySelector('.phone-empty');
  const loading = root.querySelector('.phone-loading');
  const fab = root.querySelector('.phone-fab');
  let loadedUrl = '';

  root.querySelectorAll('[data-view]').forEach((b) => b.addEventListener('click', () => {
    const v = b.dataset.view;
    if (v === 'desktop') store.set({ previewDesktop: !store.get().previewDesktop });
    else store.set({ previewLandscape: v === 'landscape' });
  }));
  frame.addEventListener('load', () => { loading.hidden = true; });

  const render = (s) => {
    const land = s.previewLandscape;
    const full = s.features.fullscreen;
    device.classList.toggle('is-landscape', land);
    stage.classList.toggle('is-landscape', land);
    root.querySelector('[data-view="portrait"]').classList.toggle('active', !land);
    root.querySelector('[data-view="landscape"]').classList.toggle('active', land);
    root.querySelector('[data-view="desktop"]').classList.toggle('active', s.previewDesktop);

    const W = land ? 560 : 280;
    const H = land ? 280 : 560;
    const top = full ? 0 : 24;
    statusbar.hidden = full;
    statusbar.style.background = s.themeColor;
    statusbar.style.color = onColor(s.themeColor);

    const viewport = s.previewDesktop ? 1280 : (land ? 740 : 375);
    const scale = W / viewport;
    Object.assign(frame.style, { top: top + 'px', width: viewport + 'px', height: (H - top) / scale + 'px', transform: `scale(${scale})` });
    empty.style.top = loading.style.top = top + 'px';

    fab.hidden = !s.features.floatingMenu;
    fab.style.background = s.themeColor;
    fab.style.color = onColor(s.themeColor);

    if (s.previewUrl && s.previewUrl !== loadedUrl) {
      loadedUrl = s.previewUrl;
      empty.hidden = true;
      loading.hidden = false;
      frame.src = s.previewUrl;
    }
  };
  store.subscribe(render);
  render(store.get());
  return root;
}
