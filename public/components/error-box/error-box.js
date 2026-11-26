import { el, esc } from '../../utils/dom.js';
import { icon } from '../../utils/icons.js';

/**
 * Red message box. show({ title, messages, retry }) / hide().
 * retry: optional callback, shows a "Try again" button.
 */
export function ErrorBox() {
  const root = el(`<div class="error-box" role="alert" hidden></div>`);
  return {
    root,
    show({ title, messages = [], retry }) {
      root.innerHTML = `
        <span class="error-box-icon">${icon('alert', 18)}</span>
        <div class="error-box-body">
          <b>${esc(title)}</b>
          ${messages.length === 1 ? `<p>${esc(messages[0])}</p>` : messages.length ? `<ul>${messages.map((m) => `<li>${esc(m)}</li>`).join('')}</ul>` : ''}
          ${retry ? `<button type="button" class="btn btn-secondary btn-sm error-box-retry">${icon('refresh', 14)}Try again</button>` : ''}
        </div>`;
      if (retry) root.querySelector('.error-box-retry').addEventListener('click', retry);
      root.hidden = false;
    },
    hide() { root.hidden = true; root.innerHTML = ''; },
  };
}
