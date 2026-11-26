import { el, esc } from '../../utils/dom.js';

/**
 * A row with title, description and an on/off switch.
 * options: { title, desc, badge, compact, getValue(state), isDisabled(state), onChange(value) }
 */
export function ToggleSwitch(store, { title, desc, badge, compact = false, getValue, isDisabled, onChange }) {
  const root = el(`
    <label class="toggle${compact ? ' toggle-compact' : ''}">
      <input type="checkbox" class="toggle-input">
      <span class="toggle-text">
        <span class="toggle-title">${esc(title)}${badge ? `<span class="toggle-badge">${esc(badge)}</span>` : ''}</span>
        ${desc ? `<span class="toggle-desc">${esc(desc)}</span>` : ''}
      </span>
      <span class="toggle-track" aria-hidden="true"></span>
    </label>`);
  const input = root.querySelector('input');
  input.addEventListener('change', () => onChange(input.checked));

  const render = (s) => {
    const on = !!getValue(s);
    const disabled = isDisabled ? isDisabled(s) : false;
    input.checked = on;
    input.disabled = disabled;
    root.classList.toggle('is-on', on);
    root.classList.toggle('is-disabled', disabled);
  };
  store.subscribe(render);
  render(store.get());
  return root;
}
