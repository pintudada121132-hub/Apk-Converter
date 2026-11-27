import { el, esc } from '../../utils/dom.js';
import { icon } from '../../utils/icons.js';
import { Card } from '../card/card.js';
import { ToggleSwitch } from '../toggle-switch/toggle-switch.js';

// Step 6: Google AdMob ads (banner, interstitial, app open) with your own app and unit IDs.

// Google's official sample IDs: they always show test ads and are safe to tap.
const TEST_IDS = {
  appId: 'ca-app-pub-3940256099942544~3347511713',
  bannerId: 'ca-app-pub-3940256099942544/9214589741',
  interstitialId: 'ca-app-pub-3940256099942544/1033173712',
  appOpenId: 'ca-app-pub-3940256099942544/9257395921',
};

// key = field in state.ads, field = key in state.fieldErrors
const input = ({ key, field, label, placeholder, hint, type = 'text', min, max }) => `
  <div class="field" data-field="${field}">
    <label class="field-label" for="f-ads-${key}">${label}</label>
    <input class="input" id="f-ads-${key}" data-key="${key}" type="${type}" placeholder="${esc(placeholder)}" spellcheck="false" autocomplete="off"
      ${min !== undefined ? `min="${min}"` : ''} ${max !== undefined ? `max="${max}"` : ''}>
    <div class="field-error"></div>
    ${hint ? `<div class="field-hint">${hint}</div>` : ''}
  </div>`;

const section = (iconName, title, desc, html) => `
  <div class="ads-section">
    <div class="ads-section-head">${icon(iconName, 15)}<span><b>${title}</b>${desc}</span></div>
    ${html}
  </div>`;

export function AdsCard(store) {
  const { root, body } = Card({ step: 6, title: 'Ads', subtitle: 'Optional: earn money with Google AdMob' });

  const patchAds = (patch) => store.set({ ads: { ...store.get().ads, ...patch } });

  body.appendChild(ToggleSwitch(store, {
    title: 'Show AdMob ads',
    desc: 'Adds the Google Mobile Ads SDK and shows ads with your ad unit IDs',
    getValue: (s) => s.ads.enabled,
    onChange: (v) => patchAds({ enabled: v }),
  }));

  const fields = el(`
    <div class="ads-fields">
      <div class="ads-toolbar">
        <span>Find these in <a href="https://admob.google.com" target="_blank" rel="noopener">AdMob</a> › Apps. Leave a unit ID empty to skip that ad type.</span>
        <button type="button" class="btn btn-secondary btn-sm ads-test">${icon('bolt', 14)}Use Google test IDs</button>
      </div>
      ${input({ key: 'appId', field: 'adsAppId', label: 'AdMob app ID', placeholder: 'ca-app-pub-0000000000000000~0000000000', hint: 'Required. Has a <code>~</code> in it.' })}

      ${section('phone', 'Banner', 'A strip at the top or bottom of the screen', `
        <div class="grid ads-grid-banner">
          ${input({ key: 'bannerId', field: 'adsBanner', label: 'Banner ad unit ID', placeholder: 'ca-app-pub-0000000000000000/0000000000' })}
          <div class="field">
            <label class="field-label" for="f-ads-bannerPosition">Position</label>
            <select class="input" id="f-ads-bannerPosition" data-key="bannerPosition">
              <option value="bottom">Bottom</option><option value="top">Top</option>
            </select>
          </div>
        </div>`)}

      ${section('desktop', 'Interstitial', 'Full-screen ad between pages', `
        ${input({ key: 'interstitialId', field: 'adsInterstitial', label: 'Interstitial ad unit ID', placeholder: 'ca-app-pub-0000000000000000/0000000000' })}
        <div class="grid grid-2 ads-interstitial-rules">
          ${input({ key: 'interstitialEvery', field: 'adsEvery', label: 'Show after every', placeholder: '5', type: 'number', min: 1, max: 100, hint: 'pages the user opens' })}
          ${input({ key: 'interstitialSeconds', field: 'adsSeconds', label: 'At least this many seconds apart', placeholder: '60', type: 'number', min: 0, max: 3600, hint: 'so ads don\'t come too often' })}
        </div>`)}

      ${section('refresh', 'App open', 'Full-screen ad when the app starts or the user comes back to it', `
        ${input({ key: 'appOpenId', field: 'adsAppOpen', label: 'App open ad unit ID', placeholder: 'ca-app-pub-0000000000000000/0000000000' })}`)}

      <div class="ads-consent"></div>
      <p class="ads-note">${icon('alert', 14)}<span>Test IDs show sample ads and are safe while you try the app. Put your own IDs in before you publish,
        and never tap your own real ads: AdMob can suspend your account for it.</span></p>
    </div>`);
  body.appendChild(fields);

  fields.querySelector('.ads-consent').appendChild(ToggleSwitch(store, {
    title: 'GDPR consent form',
    desc: 'Shows Google\'s consent message to users in Europe and the UK. Create the message first in AdMob › Privacy & messaging',
    compact: false,
    getValue: (s) => s.ads.consent,
    onChange: (v) => patchAds({ consent: v }),
  }));

  const controls = [...fields.querySelectorAll('[data-key]')];
  for (const c of controls) {
    const key = c.dataset.key;
    c.addEventListener(c.tagName === 'SELECT' ? 'change' : 'input', () => {
      const s = store.get();
      const fieldName = c.closest('[data-field]')?.dataset.field;
      store.set({
        ads: { ...s.ads, [key]: c.value },
        fieldErrors: fieldName ? { ...s.fieldErrors, [fieldName]: '' } : s.fieldErrors,
      });
    });
  }

  fields.querySelector('.ads-test').addEventListener('click', () => {
    const s = store.get();
    const fieldErrors = { ...s.fieldErrors, adsAppId: '', adsBanner: '', adsInterstitial: '', adsAppOpen: '' };
    store.set({ ads: { ...s.ads, ...TEST_IDS }, fieldErrors });
  });

  const render = (s) => {
    fields.hidden = !s.ads.enabled;
    for (const c of controls) {
      const v = String(s.ads[c.dataset.key] ?? '');
      if (document.activeElement !== c && c.value !== v) c.value = v;
    }
    const interstitialOn = !!s.ads.interstitialId.trim();
    fields.querySelector('.ads-interstitial-rules').classList.toggle('is-disabled', !interstitialOn);
    fields.querySelector('#f-ads-bannerPosition').disabled = !s.ads.bannerId.trim();
    for (const f of fields.querySelectorAll('[data-field]')) {
      const msg = s.fieldErrors[f.dataset.field] || '';
      f.classList.toggle('has-error', !!msg);
      f.querySelector('.field-error').textContent = msg;
    }
  };
  store.subscribe(render);
  render(store.get());
  return root;
}
