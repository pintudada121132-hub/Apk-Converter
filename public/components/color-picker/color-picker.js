import { el, esc } from '../../utils/dom.js';
import { PALETTE } from '../../config/palette.js';

/**
 * Color input + quick swatches.
 * getValue(state) reads the current color, onPick(color) is called when the user picks one.
 */
export function ColorPicker(store, { label, getValue, onPick }) {
  const root = el(`
    <div class="color-picker">
      <label class="color-input"><input type="color"><span>${esc(label)}</span></label>
      <div class="color-swatches">
        ${PALETTE.map((c) => `<button type="button" class="color-swatch" style="background:${c}" data-color="${c}" aria-label="Use color ${c}"></button>`).join('')}
      </div>
    </div>`);
  const input = root.querySelector('input');
  input.addEventListener('input', () => onPick(input.value));
  root.querySelectorAll('.color-swatch').forEach((b) => b.addEventListener('click', () => onPick(b.dataset.color)));

  const render = (s) => {
    const value = getValue(s).toLowerCase();
    if (input.value.toLowerCase() !== value) input.value = value;
    root.querySelectorAll('.color-swatch').forEach((b) => b.classList.toggle('selected', b.dataset.color === value));
  };
  store.subscribe(render);
  render(store.get());
  return root;
}
