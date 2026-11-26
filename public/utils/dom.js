// Small DOM helpers shared by all components.

/** Builds an element from an HTML string (first top-level element). */
export function el(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

/** Escapes text before putting it inside HTML. */
export function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/** querySelector scoped to a root element. */
export const qs = (root, sel) => root.querySelector(sel);
