// Draws the app icon. The APK gets an adaptive icon: transparent FOREGROUND png + solid background color.

function drawForeground(ctx, size, state) {
  ctx.clearRect(0, 0, size, size);
  const img = state.iconImage;
  if (img) {
    const fill = state.iconFill;
    const box = fill ? size : size * 0.6; // 0.6 keeps the image inside the launcher's safe zone
    const scale = fill
      ? Math.max(box / img.width, box / img.height)
      : Math.min(box / img.width, box / img.height);
    const w = img.width * scale;
    const h = img.height * scale;
    ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
    return;
  }
  const letter = (state.appName.trim()[0] || 'A').toUpperCase();
  ctx.fillStyle = '#ffffff';
  ctx.font = `700 ${size * 0.34}px Inter, system-ui, "Segoe UI", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(letter, size / 2, size / 2 + size * 0.015);
}

/** Paints the full icon (background + foreground) onto a canvas, for previews. */
export function paintIcon(canvas, state) {
  const size = canvas.width;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = state.iconBg;
  ctx.fillRect(0, 0, size, size);
  const layer = document.createElement('canvas');
  layer.width = layer.height = size;
  drawForeground(layer.getContext('2d'), size, state);
  ctx.drawImage(layer, 0, 0);
}

/** Transparent foreground PNG (432px) that goes inside the APK. */
export function foregroundPng(state) {
  const c = document.createElement('canvas');
  c.width = c.height = 432;
  drawForeground(c.getContext('2d'), 432, state);
  return c.toDataURL('image/png');
}

/** Small full icon PNG used on the phone install page. */
export function previewPng(state, size = 192) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  paintIcon(c, state);
  return c.toDataURL('image/png');
}
