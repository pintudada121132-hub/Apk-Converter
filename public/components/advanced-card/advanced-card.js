import { el } from '../../utils/dom.js';
import { Card } from '../card/card.js';

// Step 5 (collapsed): allowed domains, user agent, custom CSS / JS.
const FIELDS = [
  { key: 'allowedDomains', label: 'Allowed domains', placeholder: 'accounts.google.com, checkout.stripe.com',
    hint: 'Comma-separated. These always open inside the app and are never blocked as redirects or pop-ups. Add login and payment sites here.' },
  { key: 'userAgent', label: 'Custom user agent', placeholder: 'Leave empty to use the default' },
];
const CODE = [
  { key: 'customCss', label: 'Custom CSS', placeholder: '.cookie-banner { display: none !important; }', hint: 'Added to every page.' },
  { key: 'customJs', label: 'Custom JavaScript', placeholder: "console.log('page loaded');", hint: 'Runs after every page load.' },
];

export function AdvancedCard(store) {
  const { root, body } = Card({ step: 5, title: 'Advanced', subtitle: 'Optional: allowed domains, user agent, custom code', collapsible: true });

  const make = (f, tag) => {
    const field = el(`
      <div class="field">
        <label class="field-label" for="f-${f.key}">${f.label}</label>
        ${tag === 'textarea'
          ? `<textarea class="input" id="f-${f.key}" placeholder="${f.placeholder}" spellcheck="false"></textarea>`
          : `<input class="input" id="f-${f.key}" type="text" placeholder="${f.placeholder}" spellcheck="false">`}
        ${f.hint ? `<div class="field-hint">${f.hint}</div>` : ''}
      </div>`);
    const input = field.querySelector('input, textarea');
    input.addEventListener('input', () => store.set({ [f.key]: input.value }));
    return field;
  };

  FIELDS.forEach((f) => body.appendChild(make(f, 'input')));
  const grid = el('<div class="grid grid-2"></div>');
  CODE.forEach((f) => grid.appendChild(make(f, 'textarea')));
  body.appendChild(grid);
  return root;
}
