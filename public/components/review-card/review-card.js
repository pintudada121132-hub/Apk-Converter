import { el, esc } from '../../utils/dom.js';
import { icon } from '../../utils/icons.js';
import { FEATURE_GROUPS } from '../../config/features.js';
import { ORIENTATION, EXTERNAL } from '../behavior-card/behavior-card.js';

// Last wizard step: a short summary of every choice, each with an "Edit" link back to its step.
const GOOGLE_TEST_APP_ID = 'ca-app-pub-3940256099942544~3347511713';
const label = (pairs, value) => (pairs.find(([v]) => v === value) || [, value])[1];

function rows(s) {
  const onFeatures = FEATURE_GROUPS.flatMap((g) => g.items)
    .filter((f) => s.features[f.key] && (!f.requires || s.features[f.requires]))
    .map((f) => f.title);
  const extra = s.extraSites.filter((x) => x.url.trim()).length;
  const perms = [['camera', 'Camera'], ['microphone', 'Microphone'], ['location', 'Location']]
    .filter(([k]) => s.permissions.enabled && s.permissions[k]).map(([, t]) => t);

  let ads = { text: 'Off' };
  if (s.ads.enabled) {
    const types = [];
    if (s.ads.bannerId.trim()) types.push(`Banner (${s.ads.bannerPosition})`);
    if (s.ads.interstitialId.trim()) types.push(`Interstitial every ${s.ads.interstitialEvery || 5} pages`);
    if (s.ads.appOpenId.trim()) types.push('App open');
    ads = { chips: types.length ? types : ['No ad units yet'] };
    if (s.ads.appId.trim() === GOOGLE_TEST_APP_ID) ads.warn = 'Using Google test IDs: no real earnings';
  }
  const custom = [s.allowedDomains.trim() && 'Allowed domains', s.userAgent.trim() && 'User agent',
    s.customCss.trim() && 'Custom CSS', s.customJs.trim() && 'Custom JavaScript'].filter(Boolean);

  return [
    { step: 'website', icon: 'globe', title: 'Website', text: s.url.trim() || '—', sub: extra ? `+ ${extra} more site${extra > 1 ? 's' : ''} (opens on a list)` : '' },
    { step: 'details', icon: 'image', title: 'App', text: s.appName.trim() || '—', sub: `${s.packageName.trim() || '—'} · v${s.versionName} (build ${s.versionCode})` },
    { step: 'blocking', icon: 'check', title: 'Features', chips: onFeatures.length ? onFeatures : ['None'] },
    { step: 'look', icon: 'palette', title: 'Look', swatch: s.themeColor, text: label(ORIENTATION, s.orientation), sub: `Other sites: ${label(EXTERNAL, s.externalLinks).toLowerCase()}` },
    { step: 'permissions', icon: 'lock', title: 'Permissions', text: perms.length ? perms.join(', ') : 'Off', sub: perms.length ? (s.permissions.askOnStart ? 'Asked when the app opens' : 'Asked when the site needs them') : '' },
    { step: 'ads', icon: 'megaphone', title: 'Ads', ...ads },
    { step: 'advanced', icon: 'code', title: 'Advanced', text: custom.length ? custom.join(', ') : 'Default' },
  ];
}

export function ReviewCard(store, { onEdit }) {
  const root = el('<div class="review"><div class="review-list"></div></div>');
  const list = root.querySelector('.review-list');

  list.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-edit]');
    if (btn) onEdit(btn.dataset.edit);
  });

  const render = (s) => {
    list.innerHTML = rows(s).map((r) => `
      <div class="review-row">
        <span class="review-icon">${icon(r.icon, 16)}</span>
        <div class="review-body">
          <span class="review-title">${esc(r.title)}</span>
          ${r.text ? `<span class="review-text">${r.swatch ? `<i class="review-swatch" style="background:${esc(r.swatch)}"></i>` : ''}${esc(r.text)}</span>` : ''}
          ${r.chips ? `<span class="review-chips">${r.chips.map((c) => `<span class="review-chip">${esc(c)}</span>`).join('')}</span>` : ''}
          ${r.sub ? `<span class="review-sub">${esc(r.sub)}</span>` : ''}
          ${r.warn ? `<span class="review-warn">${icon('alert', 13)}${esc(r.warn)}</span>` : ''}
        </div>
        <button type="button" class="review-edit" data-edit="${r.step}">Edit</button>
      </div>`).join('');
  };
  store.subscribe(render);
  render(store.get());
  return root;
}
