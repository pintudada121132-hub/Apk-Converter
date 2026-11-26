import { validateUrl } from './url.js';

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
  return errors;
}
