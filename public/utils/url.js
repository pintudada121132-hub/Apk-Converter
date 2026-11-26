// Website URL helpers.

/** Adds https:// when the user typed only a domain. */
export function normalizeUrl(value) {
  const v = String(value || '').trim();
  if (!v) return '';
  return /^https?:\/\//i.test(v) ? v : 'https://' + v;
}

/** Returns a user-friendly error message, or '' when the URL is fine. */
export function validateUrl(value) {
  const v = normalizeUrl(value);
  if (!v) return 'Enter the website link.';
  try {
    const u = new URL(v);
    if (!/^https?:$/.test(u.protocol)) return 'Only http:// and https:// links are supported.';
    if (!u.hostname.includes('.') && u.hostname !== 'localhost') return 'This doesn\'t look like a full website address (e.g. example.com).';
    return '';
  } catch {
    return 'This doesn\'t look like a valid link.';
  }
}

/** "news.example.co.uk" → { name: "News", packageName: "uk.co.example.news.app" } */
export function suggestFromUrl(value) {
  try {
    const host = new URL(normalizeUrl(value)).hostname.replace(/^www\./, '');
    const parts = host.split('.').filter(Boolean);
    if (!parts.length) return null;
    const name = parts[0].replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    const packageName = parts.length >= 2
      ? [...parts].reverse().map((s) => s.toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/^(\d)/, '_$1')).join('.') + '.app'
      : '';
    return { name, packageName };
  } catch {
    return null;
  }
}
