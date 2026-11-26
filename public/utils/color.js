// True when a hex color is light enough to need dark text/icons on top of it.
export function isLight(hex) {
  const n = parseInt(String(hex).replace('#', ''), 16);
  if (Number.isNaN(n)) return false;
  const lum = (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return lum > 0.6;
}

export const onColor = (hex) => (isLight(hex) ? '#101828' : '#ffffff');
