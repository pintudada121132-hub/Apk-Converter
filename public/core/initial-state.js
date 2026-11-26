import { FEATURE_GROUPS } from '../config/features.js';

const features = {};
for (const group of FEATURE_GROUPS) for (const f of group.items) features[f.key] = f.default;

export const initialState = {
  url: '',
  previewUrl: '',
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

  previewLandscape: false,
  previewDesktop: false,

  server: { checked: false, online: false, sdk: false, lan: [] },
  fieldErrors: {},        // { url: 'message', appName: 'message', ... }
};
