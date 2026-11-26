import { el, esc } from '../../utils/dom.js';
import { icon } from '../../utils/icons.js';

// Small message at the bottom of the screen. toast('Link copied') / toast('Failed', 'error')
let host = null;

export function toast(message, type = 'success') {
  if (!host) {
    host = el('<div class="toast-host" aria-live="polite"></div>');
    document.body.appendChild(host);
  }
  const item = el(`<div class="toast toast-${type}">${icon(type === 'error' ? 'alert' : 'checkCircle', 16)}<span>${esc(message)}</span></div>`);
  host.appendChild(item);
  setTimeout(() => item.classList.add('leaving'), 2400);
  setTimeout(() => item.remove(), 2700);
}
