import { createStore } from './core/store.js';
import { initialState } from './core/initial-state.js';
import { getStatus } from './services/api.js';
import { AppHeader } from './components/app-header/app-header.js';
import { PageIntro } from './components/page-intro/page-intro.js';
import { UrlCard } from './components/url-card/url-card.js';
import { DetailsCard } from './components/details-card/details-card.js';
import { FeatureCard } from './components/feature-card/feature-card.js';
import { BehaviorCard } from './components/behavior-card/behavior-card.js';
import { PermissionsCard } from './components/permissions-card/permissions-card.js';
import { AdsCard } from './components/ads-card/ads-card.js';
import { AdvancedCard } from './components/advanced-card/advanced-card.js';
import { BuildPanel } from './components/build-panel/build-panel.js';
import { ReviewCard } from './components/review-card/review-card.js';
import { Wizard } from './components/wizard/wizard.js';
import { PhonePreview } from './components/phone-preview/phone-preview.js';
import { normalizeUrl, validateUrl } from './utils/url.js';

const store = createStore(initialState);

// Desktop-mode switch also changes the preview.
let lastDesktop = initialState.features.desktopMode;
store.subscribe((s) => {
  if (s.features.desktopMode !== lastDesktop) {
    lastDesktop = s.features.desktopMode;
    store.set({ previewDesktop: lastDesktop });
  }
});

const app = document.getElementById('app');
app.append(AppHeader(store), PageIntro());

// The form is a step-by-step wizard: a few choices per step, Next slides to the following one.
let wizard;
const buildStep = document.createElement('div');
buildStep.append(
  ReviewCard(store, { onEdit: (id) => wizard.goTo(id) }),
  BuildPanel(store, { onFieldErrors: (errors) => wizard.showErrors(errors) }),
);
const hasCustomCode = (s) => !!(s.allowedDomains.trim() || s.userAgent.trim() || s.customCss.trim() || s.customJs.trim());

wizard = Wizard(store, [
  {
    id: 'website', label: 'Website', icon: 'globe', fields: ['url', 'sites'],
    title: 'Which website should the app open?',
    subtitle: 'Paste the link. Add more sites and the app opens on a list of them.',
    content: UrlCard(store),
    // show the site in the preview even if Preview was never pressed
    onLeave: (st) => {
      const s = st.get();
      if (!s.previewUrl && !validateUrl(s.url)) st.set({ url: normalizeUrl(s.url), previewUrl: normalizeUrl(s.url) });
    },
  },
  {
    id: 'details', label: 'App', icon: 'image', fields: ['appName', 'versionName', 'versionCode', 'packageName'],
    title: 'Name and icon', subtitle: 'What people see on their home screen.',
    content: DetailsCard(store),
  },
  {
    id: 'blocking', label: 'Blocking', icon: 'shield', optional: true,
    title: 'Block ads and annoyances', subtitle: 'Keep the website clean inside your app.',
    content: FeatureCard(store, { groups: ['Blocking'] }),
  },
  {
    id: 'navigation', label: 'Navigation', icon: 'compass', optional: true,
    title: 'Moving around', subtitle: 'Refresh, menu, back button, downloads and uploads.',
    content: FeatureCard(store, { groups: ['Navigation'] }),
  },
  {
    id: 'display', label: 'Display', icon: 'phone', optional: true,
    title: 'Screen and privacy', subtitle: 'How pages are shown, and what stays private.',
    content: FeatureCard(store, { groups: ['Display', 'Performance & privacy'] }),
  },
  {
    id: 'look', label: 'Look', icon: 'palette', optional: true,
    title: 'Rotation, links and colors', subtitle: 'Screen rotation, links to other websites and the theme color.',
    content: BehaviorCard(store),
  },
  {
    id: 'permissions', label: 'Permissions', icon: 'lock', optional: true,
    isSkipped: (s) => !s.permissions.enabled || !(s.permissions.camera || s.permissions.microphone || s.permissions.location),
    title: 'App permissions', subtitle: 'Off unless you switch them on. Skip this step if the site doesn’t need the camera, microphone or location.',
    content: PermissionsCard(store),
  },
  {
    id: 'ads', label: 'Ads', icon: 'megaphone', optional: true,
    fields: ['adsAppId', 'adsBanner', 'adsInterstitial', 'adsAppOpen', 'adsEvery', 'adsSeconds'],
    isSkipped: (s) => !s.ads.enabled,
    title: 'Earn with ads', subtitle: 'Ads are off unless you switch them on. Skip this step if you don’t want ads.',
    content: AdsCard(store),
  },
  {
    id: 'advanced', label: 'Advanced', icon: 'code', optional: true,
    isSkipped: (s) => !hasCustomCode(s),
    title: 'Advanced', subtitle: 'Allowed domains, user agent and your own CSS or JavaScript. Most apps don’t need this.',
    content: AdvancedCard(store),
  },
  {
    id: 'build', label: 'Build', icon: 'rocket',
    title: 'Review and build', subtitle: 'Check your choices, then build the APK.',
    content: buildStep,
  },
]);
const layout = document.createElement('main');
layout.className = 'layout';
const form = wizard.root;
const side = document.createElement('aside');
side.className = 'layout-side';
side.append(PhonePreview(store));
layout.append(form, side);
app.append(layout);

// Check build server / SDK / network address, and re-check every 15s.
async function refreshStatus() {
  try {
    const s = await getStatus();
    store.set({ server: { checked: true, online: true, sdk: !!s.sdk, lan: s.lan || [] } });
  } catch {
    store.set({ server: { ...store.get().server, checked: true, online: false } });
  }
}
refreshStatus();
setInterval(refreshStatus, 15000);
