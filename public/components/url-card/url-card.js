import { el } from '../../utils/dom.js';
import { icon } from '../../utils/icons.js';
import { normalizeUrl, validateUrl, suggestFromUrl } from '../../utils/url.js';
import { Card } from '../card/card.js';

// Step 1: website link + Preview button. Also auto-fills app name / package name.
export function UrlCard(store) {
  const { root, body } = Card({ step: 1, title: 'Website', subtitle: 'The page your app opens when it starts' });
  const content = el(`
    <div class="field" data-field="url">
      <div class="url-row">
        <div class="url-input">
          ${icon('globe', 18)}
          <input class="input" type="url" placeholder="https://example.com" autocomplete="off" spellcheck="false" aria-label="Website link">
        </div>
        <button class="btn btn-secondary" type="button">Preview</button>
      </div>
      <div class="field-error"></div>
    </div>`);
  body.appendChild(content);

  const input = content.querySelector('input');
  const button = content.querySelector('button');

  input.addEventListener('input', () => {
    const s = store.get();
    const fieldErrors = { ...s.fieldErrors, url: '' };
    const patch = { url: input.value, fieldErrors };
    const suggestion = suggestFromUrl(input.value);
    if (suggestion) {
      // auto-filled fields are valid now, so clear their old errors too
      if (!s.nameTouched) { patch.appName = suggestion.name; fieldErrors.appName = ''; }
      if (!s.packageTouched && suggestion.packageName) { patch.packageName = suggestion.packageName; fieldErrors.packageName = ''; }
    }
    store.set(patch);
  });

  const preview = () => {
    const error = validateUrl(input.value);
    if (error) {
      store.set({ fieldErrors: { ...store.get().fieldErrors, url: error } });
      input.focus();
      return;
    }
    const url = normalizeUrl(input.value);
    input.value = url;
    store.set({ url, previewUrl: url });
  };
  button.addEventListener('click', preview);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') preview(); });

  store.subscribe((s) => {
    if (document.activeElement !== input && input.value !== s.url) input.value = s.url;
    const msg = s.fieldErrors.url || '';
    content.classList.toggle('has-error', !!msg);
    content.querySelector('.field-error').textContent = msg;
  });
  return root;
}
