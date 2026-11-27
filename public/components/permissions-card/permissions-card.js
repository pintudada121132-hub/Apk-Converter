import { el } from '../../utils/dom.js';
import { icon } from '../../utils/icons.js';
import { Card } from '../card/card.js';
import { ToggleSwitch } from '../toggle-switch/toggle-switch.js';

// Optional step: which phone features the website may use (camera, microphone, location).
// Off by default; the master switch reveals the choices.
const PERMISSIONS = [
  { key: 'camera', icon: 'camera', title: 'Camera', desc: 'Video calls, QR code scanners, taking photos on the site' },
  { key: 'microphone', icon: 'mic', title: 'Microphone', desc: 'Voice and video calls, voice notes, voice search' },
  { key: 'location', icon: 'pin', title: 'Location', desc: 'Maps, "near me" search, delivery address' },
];
const ASK = [
  ['need', 'When the website needs it'],
  ['start', 'As soon as the app opens'],
];

export function PermissionsCard(store) {
  const { root, body } = Card({ step: 5, title: 'App permissions', subtitle: 'Phone features the website is allowed to use' });
  const patch = (p) => store.set({ permissions: { ...store.get().permissions, ...p } });

  body.appendChild(ToggleSwitch(store, {
    title: 'Use phone permissions',
    desc: 'Let the website use the camera, microphone or location. Leave off if it doesn’t need them',
    getValue: (s) => s.permissions.enabled,
    onChange: (v) => patch({ enabled: v }),
  }));

  const fields = el('<div class="permission-fields"></div>');
  const grid = el('<div class="permission-grid"></div>');
  for (const p of PERMISSIONS) {
    const toggle = ToggleSwitch(store, {
      title: p.title,
      desc: p.desc,
      getValue: (s) => s.permissions[p.key],
      onChange: (v) => patch({ [p.key]: v }),
    });
    toggle.querySelector('.toggle-text').insertAdjacentHTML('beforebegin', `<span class="permission-icon">${icon(p.icon, 18)}</span>`);
    grid.appendChild(toggle);
  }
  fields.appendChild(grid);

  const ask = el(`
    <div class="field permission-ask">
      <label class="field-label" for="f-permission-ask">Ask the user</label>
      <select class="input" id="f-permission-ask">${ASK.map(([v, t]) => `<option value="${v}">${t}</option>`).join('')}</select>
    </div>`);
  const select = ask.querySelector('select');
  select.addEventListener('change', () => patch({ askOnStart: select.value === 'start' }));
  fields.appendChild(ask);

  fields.appendChild(el(`<p class="permission-note">${icon('info', 14)}<span>Only the permissions switched on here are added to the app, and Android asks the user before any of them is used.</span></p>`));
  body.appendChild(fields);

  body.appendChild(el(`<p class="permission-note permission-auto">${icon('info', 14)}<span>Storage permission for downloads on Android 8–9 is added automatically, whether this is on or off.</span></p>`));

  const render = (s) => {
    const p = s.permissions;
    fields.hidden = !p.enabled;
    const any = p.camera || p.microphone || p.location;
    select.value = p.askOnStart ? 'start' : 'need';
    select.disabled = !any;
    ask.classList.toggle('is-disabled', !any);
  };
  store.subscribe(render);
  render(store.get());
  return root;
}
