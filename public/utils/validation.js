import { validateUrl } from './url.js';

export const ADMOB_APP_ID = /^ca-app-pub-\d{10,20}~\d{6,12}$/;
export const ADMOB_UNIT_ID = /^ca-app-pub-\d{10,20}\/\d{6,12}$/;

function validateAds(ads) {
  const errors = {};
  const appId = ads.appId.trim();
  if (!appId) errors.adsAppId = 'Enter your AdMob app ID (AdMob › Apps › App settings).';
  else if (!ADMOB_APP_ID.test(appId)) {
    errors.adsAppId = ADMOB_UNIT_ID.test(appId)
      ? 'That is an ad unit ID. The app ID has a ~ in it: ca-app-pub-0000000000000000~0000000000'
      : 'App ID looks like ca-app-pub-0000000000000000~0000000000';
  }
  const units = [['bannerId', 'adsBanner'], ['interstitialId', 'adsInterstitial'], ['appOpenId', 'adsAppOpen']];
  for (const [key, field] of units) {
    const v = ads[key].trim();
    if (!v) continue;
    if (!ADMOB_UNIT_ID.test(v)) {
      errors[field] = ADMOB_APP_ID.test(v)
        ? 'That is the app ID. Ad unit IDs have a / in them: ca-app-pub-0000000000000000/0000000000'
        : 'Ad unit ID looks like ca-app-pub-0000000000000000/0000000000';
    }
  }
  if (!units.some(([key]) => ads[key].trim())) errors.adsBanner = 'Add at least one ad unit ID (banner, interstitial or app open).';
  if (ads.interstitialId.trim()) {
    const every = Number(ads.interstitialEvery);
    const secs = Number(ads.interstitialSeconds);
    if (!Number.isInteger(every) || every < 1 || every > 100) errors.adsEvery = 'Use 1 to 100 pages.';
    if (!Number.isInteger(secs) || secs < 0 || secs > 3600) errors.adsSeconds = 'Use 0 to 3600 seconds.';
  }
  return errors;
}

// Checks the form before sending it to the build server. Returns { field: message }.
export function validateForm(state) {
  const errors = {};
  const urlError = validateUrl(state.url);
  if (urlError) errors.url = urlError;

  for (const [i, site] of state.extraSites.entries()) {
    if (!site.url.trim() && !site.name.trim()) continue; // empty rows are skipped
    const error = validateUrl(site.url);
    if (error) { errors.sites = `Site ${i + 2}: ${error}`; break; }
  }

  const name = state.appName.trim();
  if (!name) errors.appName = 'Give your app a name.';
  else if (name.length > 50) errors.appName = 'Keep the name under 50 characters.';

  const pkg = state.packageName.trim();
  if (!pkg) errors.packageName = 'Enter a package name, e.g. com.mysite.app';
  else if (!/^[a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z][a-zA-Z0-9_]*)+$/.test(pkg)) {
    errors.packageName = 'Use at least two parts separated by dots, letters/numbers only, e.g. com.mysite.app';
  }

  if (!/^[\w.\-]{1,20}$/.test(state.versionName.trim())) errors.versionName = 'Use something like 1.0.0';
  if (!/^\d{1,9}$/.test(String(state.versionCode).trim()) || Number(state.versionCode) < 1) errors.versionCode = 'Whole number, 1 or higher';

  if (state.ads.enabled) Object.assign(errors, validateAds(state.ads));
  return errors;
}
