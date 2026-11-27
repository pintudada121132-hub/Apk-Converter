import { el } from '../../utils/dom.js';
import { Card } from '../card/card.js';
import { ColorPicker } from '../color-picker/color-picker.js';

// Step 4: rotation, external link handling, theme color.
export const ORIENTATION = [
  ['auto', 'Follow phone setting'],
  ['sensor', 'Always rotate'],
  ['portrait', 'Lock to portrait'],
  ['landscape', 'Lock to landscape'],
];
export const EXTERNAL = [
  ['browser', 'Open in the phone\'s browser'],
  ['inside', 'Open inside the app'],
  ['block', 'Block them'],
];

const select = (id, label, options) => `
  <div class="field">
    <label class="field-label" for="${id}">${label}</label>
    <select class="input" id="${id}">${options.map(([v, t]) => `<option value="${v}">${t}</option>`).join('')}</select>
  </div>`;

export function BehaviorCard(store) {
  const { root, body } = Card({ step: 4, title: 'Behavior & look', subtitle: 'Rotation, link handling and colors' });
  const grid = el(`<div class="grid grid-2">${select('f-orientation', 'Screen rotation', ORIENTATION)}${select('f-external', 'Links to other websites', EXTERNAL)}</div>`);
  body.appendChild(grid);

  const orientation = grid.querySelector('#f-orientation');
  const external = grid.querySelector('#f-external');
  orientation.addEventListener('change', () => {
    const v = orientation.value;
    const patch = { orientation: v };
    if (v === 'landscape') patch.previewLandscape = true;
    if (v === 'portrait') patch.previewLandscape = false;
    store.set(patch);
  });
  external.addEventListener('change', () => store.set({ externalLinks: external.value }));

  const theme = el('<div class="field"><span class="field-label">Theme color</span><div class="field-hint" style="margin:0 0 8px">Used for the status bar, loading bar and menu button.</div></div>');
  theme.appendChild(ColorPicker(store, {
    label: 'Theme',
    getValue: (s) => s.themeColor,
    onPick: (c) => {
      const s = store.get();
      store.set(s.iconFollowsTheme ? { themeColor: c, iconBg: c } : { themeColor: c });
    },
  }));
  body.appendChild(theme);

  store.subscribe((s) => {
    orientation.value = s.orientation;
    external.value = s.externalLinks;
  });
  return root;
}
