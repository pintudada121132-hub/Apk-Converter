import { el, esc } from '../../utils/dom.js';
import { icon } from '../../utils/icons.js';
import { paintIcon } from '../../utils/icon-render.js';
import { ColorPicker } from '../color-picker/color-picker.js';
import { ToggleSwitch } from '../toggle-switch/toggle-switch.js';

const MAX_SIZE = 8 * 1024 * 1024;
const DEFAULT_TEXT = 'Upload an image or drop it here';

// App icon: preview, upload / drag & drop, background color and "fill" option.
export function IconEditor(store) {
  const root = el(`
    <div class="field icon-editor">
      <span class="field-label">App icon</span>
      <div class="icon-editor-row">
        <div class="icon-editor-preview">
          <canvas width="432" height="432" aria-label="Icon preview"></canvas>
          <span class="icon-editor-name"></span>
        </div>
        <div class="icon-editor-controls">
          <label class="icon-drop">
            ${icon('image', 18)}
            <span class="icon-drop-text">${DEFAULT_TEXT}</span>
            <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml">
            <button type="button" class="icon-drop-remove" aria-label="Remove image">${icon('x', 14)}</button>
          </label>
          <div class="icon-editor-options"></div>
          <div class="field-error icon-error"></div>
          <span class="field-hint">PNG or JPG, square works best. Without an image, the first letter of the app name is used.</span>
        </div>
      </div>
    </div>`);

  const canvas = root.querySelector('canvas');
  const drop = root.querySelector('.icon-drop');
  const fileInput = root.querySelector('input[type=file]');
  const dropText = root.querySelector('.icon-drop-text');
  const error = root.querySelector('.icon-error');

  const options = root.querySelector('.icon-editor-options');
  options.appendChild(ColorPicker(store, {
    label: 'Background',
    getValue: (s) => s.iconBg,
    onPick: (c) => store.set({ iconBg: c, iconFollowsTheme: false }),
  }));
  options.appendChild(ToggleSwitch(store, {
    title: 'Fill icon', compact: true,
    getValue: (s) => s.iconFill,
    isDisabled: (s) => !s.iconImage,
    onChange: (v) => store.set({ iconFill: v }),
  }));

  const showError = (msg) => { error.textContent = msg; root.classList.toggle('has-error', !!msg); };

  function loadFile(file) {
    showError('');
    if (!file) return;
    if (!file.type.startsWith('image/')) return showError('That file isn\'t an image. Choose a PNG or JPG.');
    if (file.size > MAX_SIZE) return showError('That image is larger than 8 MB. Choose a smaller one.');
    const img = new Image();
    img.onload = () => store.set({ iconImage: img, iconFileName: file.name });
    img.onerror = () => showError('This image couldn\'t be opened. Try a different file.');
    img.src = URL.createObjectURL(file);
  }

  fileInput.addEventListener('change', () => loadFile(fileInput.files[0]));
  root.querySelector('.icon-drop-remove').addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    fileInput.value = '';
    showError('');
    store.set({ iconImage: null, iconFileName: '', iconFill: false });
  });
  ['dragenter', 'dragover'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('is-dragging'); }));
  ['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('is-dragging'); }));
  drop.addEventListener('drop', (e) => loadFile(e.dataTransfer.files[0]));

  const render = (s) => {
    paintIcon(canvas, s);
    root.querySelector('.icon-editor-name').textContent = s.appName.trim() || 'My App';
    drop.classList.toggle('has-file', !!s.iconImage);
    dropText.innerHTML = s.iconImage ? esc(s.iconFileName) : DEFAULT_TEXT;
  };
  store.subscribe(render);
  render(store.get());
  return root;
}
