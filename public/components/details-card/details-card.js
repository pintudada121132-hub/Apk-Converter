import { el } from '../../utils/dom.js';
import { Card } from '../card/card.js';
import { IconEditor } from '../icon-editor/icon-editor.js';

// Step 2: app name, version, build number, package name and the icon editor.
const FIELDS = [
  { key: 'appName', label: 'App name', placeholder: 'My App', type: 'text', max: 50, touched: 'nameTouched' },
  { key: 'versionName', label: 'Version', placeholder: '1.0.0', type: 'text' },
  { key: 'versionCode', label: 'Build number', placeholder: '1', type: 'number' },
];

export function DetailsCard(store) {
  const { root, body } = Card({ step: 2, title: 'App details', subtitle: 'Name, identity and icon shown on the phone' });

  const row = el('<div class="grid grid-3"></div>');
  const inputs = {};
  for (const f of FIELDS) {
    const field = el(`
      <div class="field" data-field="${f.key}">
        <label class="field-label" for="f-${f.key}">${f.label}</label>
        <input class="input" id="f-${f.key}" type="${f.type}" placeholder="${f.placeholder}" ${f.max ? `maxlength="${f.max}"` : ''} ${f.type === 'number' ? 'min="1"' : ''}>
        <div class="field-error"></div>
      </div>`);
    row.appendChild(field);
    inputs[f.key] = { field, input: field.querySelector('input'), touched: f.touched };
  }
  body.appendChild(row);

  const pkg = el(`
    <div class="field" data-field="packageName">
      <label class="field-label" for="f-packageName">Package name</label>
      <input class="input" id="f-packageName" type="text" placeholder="com.example.app" spellcheck="false">
      <div class="field-error"></div>
      <div class="field-hint">A unique ID for the app. To update an installed app, keep this the same and raise the build number.</div>
    </div>`);
  body.appendChild(pkg);
  inputs.packageName = { field: pkg, input: pkg.querySelector('input'), touched: 'packageTouched' };

  for (const [key, { input, touched }] of Object.entries(inputs)) {
    input.addEventListener('input', () => {
      const s = store.get();
      const patch = { [key]: input.value, fieldErrors: { ...s.fieldErrors, [key]: '' } };
      if (touched) patch[touched] = true;
      store.set(patch);
    });
  }

  body.appendChild(IconEditor(store));

  const render = (s) => {
    for (const [key, { field, input }] of Object.entries(inputs)) {
      if (document.activeElement !== input && input.value !== String(s[key])) input.value = s[key];
      const msg = s.fieldErrors[key] || '';
      field.classList.toggle('has-error', !!msg);
      field.querySelector('.field-error').textContent = msg;
    }
  };
  store.subscribe(render);
  render(store.get());
  return root;
}
