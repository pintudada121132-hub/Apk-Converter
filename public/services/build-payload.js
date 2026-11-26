import { BUILD_ONLY_FEATURES } from '../config/features.js';
import { normalizeUrl } from '../utils/url.js';
import { foregroundPng, previewPng } from '../utils/icon-render.js';

// Turns the form state into the JSON body the build server expects.
export function buildPayload(state) {
  const config = {
    url: normalizeUrl(state.url),
    orientation: state.orientation,
    externalLinks: state.externalLinks,
    themeColor: state.themeColor,
    userAgent: state.userAgent.trim(),
    allowedDomains: state.allowedDomains.split(',').map((s) => s.trim()).filter(Boolean),
    customCss: state.customCss,
    customJs: state.customJs,
  };
  for (const [key, value] of Object.entries(state.features)) {
    if (!BUILD_ONLY_FEATURES.includes(key)) config[key] = value;
  }
  return {
    config,
    appName: state.appName.trim(),
    packageName: state.packageName.trim(),
    versionName: state.versionName.trim(),
    versionCode: String(state.versionCode).trim(),
    iconBg: state.iconBg,
    iconForeground: foregroundPng(state),
    iconPreview: previewPng(state),
    strongBlocklist: state.features.adBlock && state.features.strongBlocklist,
  };
}
