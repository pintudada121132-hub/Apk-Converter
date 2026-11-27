import { FEATURE_GROUPS } from '../config/features.js';

const features = {};
for (const group of FEATURE_GROUPS) for (const f of group.items) features[f.key] = f.default;

export const initialState = {
  url: '',
  previewUrl: '',
  siteName: '',           // name of the first site (shown only when there are several)
  extraSites: [],         // [{ name, url }] more sites: the app then opens on a list of them
  appName: '',
  packageName: '',
  versionName: '1.0.0',
  versionCode: '1',
  nameTouched: false,
  packageTouched: false,

  iconImage: null,        // HTMLImageElement or null
  iconFileName: '',
  iconBg: '#2563eb',
  iconFill: false,
  iconFollowsTheme: true,

  features,
  orientation: 'auto',
  externalLinks: 'browser',
  themeColor: '#2563eb',
  allowedDomains: '',
  userAgent: '',
  customCss: '',
  customJs: '',

  // Phone features the website may use (optional, off by default). Only these go into the app's manifest.
  permissions: { enabled: false, camera: false, microphone: false, location: false, askOnStart: false },

  // AdMob. Empty unit IDs switch that ad type off.
  ads: {
    enabled: false,
    appId: '',
    bannerId: '',
    bannerPosition: 'bottom',
    interstitialId: '',
    interstitialEvery: '5',
    interstitialSeconds: '60',
    appOpenId: '',
    consent: false,
  },

  previewLandscape: false,
  previewDesktop: false,

  server: { checked: false, online: false, sdk: false, lan: [] },
  fieldErrors: {},        // { url: 'message', appName: 'message', ... }
};
