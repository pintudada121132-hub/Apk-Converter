import { el, esc } from '../../utils/dom.js';
import { icon } from '../../utils/icons.js';
import { normalizeUrl, validateUrl, suggestFromUrl } from '../../utils/url.js';
import { Card } from '../card/card.js';

export const MAX_SITES = 20;

// Step 1: website link + Preview button. Also auto-fills app name / package name.
// "Add another website" turns the app into a multi-site app: it opens on a list of the sites.
export function UrlCard(store) {
  const { root, body } = Card({ step: 1, title: 'Website', subtitle: 'The page your app opens. Add more sites to open a list of them first' });
  const content = el(`
    <div class="field" data-field="url">
      <div class="url-row">
        <input class="input url-name" type="text" placeholder="Name" maxlength="40" autocomplete="off" aria-label="Site name" hidden>
        <div class="url-input">
          ${icon('globe', 18)}
          <input class="input url-main" type="url" placeholder="https://example.com" autocomplete="off" spellcheck="false" aria-label="Website link">
        </div>
        <button class="btn btn-secondary url-preview" type="button">Preview</button>
      </div>
      <div class="field-error"></div>
    </div>`);
  const extras = el(`
    <div class="field url-extras" data-field="sites">
      <div class="url-extra-list"></div>
      <button class="btn btn-secondary btn-sm url-add" type="button">${icon('plus', 15)}Add another website</button>
      <p class="field-hint url-multi-hint" hidden>The app opens on a list of these sites. Tap a site to open it, and use Home in the menu or the back button to return to the list.</p>
    </div>`);
  body.append(content, extras);

  const input = content.querySelector('.url-main');
  const nameInput = content.querySelector('.url-name');
  const list = extras.querySelector('.url-extra-list');
  const addBtn = extras.querySelector('.url-add');
  const hint = extras.querySelector('.url-multi-hint');

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
  nameInput.addEventListener('input', () => store.set({ siteName: nameInput.value }));

  const preview = (inputEl, onValid) => {
    const error = validateUrl(inputEl.value);
    if (error) return error;
    const url = normalizeUrl(inputEl.value);
    inputEl.value = url;
    onValid(url);
    return '';
  };
  const previewMain = () => {
    const error = preview(input, (url) => store.set({ url, previewUrl: url }));
    if (error) { store.set({ fieldErrors: { ...store.get().fieldErrors, url: error } }); input.focus(); }
  };
  content.querySelector('.url-preview').addEventListener('click', previewMain);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') previewMain(); });

  // ---- extra sites
  const setExtra = (i, patch) => {
    const s = store.get();
    const extraSites = s.extraSites.map((site, j) => (j === i ? { ...site, ...patch } : site));
    store.set({ extraSites, fieldErrors: { ...s.fieldErrors, sites: '' } });
  };

  function renderRows(sites) {
    list.textContent = '';
    sites.forEach((site, i) => {
      const row = el(`
        <div class="url-extra">
        <div class="url-row">
          <input class="input url-name" type="text" placeholder="Name" maxlength="40" autocomplete="off" aria-label="Site ${i + 2} name" value="${esc(site.name)}">
          <div class="url-input">
            ${icon('globe', 18)}
            <input class="input url-link" type="url" placeholder="https://another-site.com" autocomplete="off" spellcheck="false" aria-label="Site ${i + 2} link" value="${esc(site.url)}">
          </div>
          <button class="btn btn-secondary url-remove" type="button" aria-label="Remove site ${i + 2}" title="Remove">${icon('x', 16)}</button>
        </div>
        <div class="url-row-error"></div>
        </div>`);
      const link = row.querySelector('.url-link');
      row.querySelector('.url-name').addEventListener('input', (e) => setExtra(i, { name: e.target.value }));
      link.addEventListener('input', () => setExtra(i, { url: link.value }));
      link.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter') return;
        const error = preview(link, (url) => { setExtra(i, { url }); store.set({ previewUrl: url }); });
        if (error) store.set({ fieldErrors: { ...store.get().fieldErrors, sites: `Site ${i + 2}: ${error}` } });
      });
      row.querySelector('.url-remove').addEventListener('click', () => {
        const s = store.get();
        store.set({ extraSites: s.extraSites.filter((_, j) => j !== i), fieldErrors: { ...s.fieldErrors, sites: '' } });
      });
      list.appendChild(row);
    });
  }

  addBtn.addEventListener('click', () => {
    const s = store.get();
    if (s.extraSites.length + 1 >= MAX_SITES) return;
    store.set({ extraSites: [...s.extraSites, { name: '', url: '' }] });
    list.lastElementChild?.querySelector('.url-link')?.focus();
  });

  let renderedCount = -1;
  store.subscribe((s) => {
    if (document.activeElement !== input && input.value !== s.url) input.value = s.url;
    if (document.activeElement !== nameInput && nameInput.value !== s.siteName) nameInput.value = s.siteName;
    const msg = s.fieldErrors.url || '';
    content.classList.toggle('has-error', !!msg);
    content.querySelector('.field-error').textContent = msg;

    if (s.extraSites.length !== renderedCount) {
      renderedCount = s.extraSites.length;
      renderRows(s.extraSites);
    }
    const multi = s.extraSites.length > 0;
    nameInput.hidden = !multi;
    hint.hidden = !multi;
    addBtn.hidden = s.extraSites.length + 1 >= MAX_SITES;
    // mark exactly the rows that are wrong, with the message under each one
    const showErrors = !!s.fieldErrors.sites;
    [...list.children].forEach((row, i) => {
      const site = s.extraSites[i];
      const empty = !site.url.trim() && !site.name.trim();
      const msg = showErrors && !empty ? validateUrl(site.url) : '';
      row.classList.toggle('url-bad', !!msg);
      row.querySelector('.url-row-error').textContent = msg;
    });
  });
  return root;
}
