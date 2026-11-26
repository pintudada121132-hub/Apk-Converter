import { el, esc } from '../../utils/dom.js';
import { icon } from '../../utils/icons.js';

/**
 * Shared card shell: numbered header + body.
 * collapsible: true renders it as <details> (closed by default).
 */
export function Card({ step, title, subtitle, collapsible = false }) {
  const head = `
    <span class="card-step">${esc(step)}</span>
    <span class="card-titles"><span class="card-title">${esc(title)}</span>${subtitle ? `<span class="card-subtitle">${esc(subtitle)}</span>` : ''}</span>`;
  const root = collapsible
    ? el(`<details class="card card-collapsible"><summary class="card-head">${head}<span class="card-chevron">${icon('chevronDown', 18)}</span></summary><div class="card-body"></div></details>`)
    : el(`<section class="card"><div class="card-head">${head}</div><div class="card-body"></div></section>`);
  return { root, body: root.querySelector('.card-body') };
}
