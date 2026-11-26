import { createStore } from './core/store.js';
import { initialState } from './core/initial-state.js';
import { getStatus } from './services/api.js';
import { AppHeader } from './components/app-header/app-header.js';
import { PageIntro } from './components/page-intro/page-intro.js';
import { UrlCard } from './components/url-card/url-card.js';
import { DetailsCard } from './components/details-card/details-card.js';
import { FeatureCard } from './components/feature-card/feature-card.js';
import { BehaviorCard } from './components/behavior-card/behavior-card.js';
import { AdvancedCard } from './components/advanced-card/advanced-card.js';
import { BuildPanel } from './components/build-panel/build-panel.js';
import { PhonePreview } from './components/phone-preview/phone-preview.js';

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

const layout = document.createElement('main');
layout.className = 'layout';
const form = document.createElement('div');
form.append(UrlCard(store), DetailsCard(store), FeatureCard(store), BehaviorCard(store), AdvancedCard(store), BuildPanel(store));
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
