import { el } from '../../utils/dom.js';

/**
 * Renders `text` as a QR code on a canvas (uses vendor/qrcode.js).
 * Returns the element; call .update(text) to redraw.
 */
export function QrCode(text, size = 176) {
  const root = el('<div class="qr-code"><canvas></canvas></div>');
  const canvas = root.querySelector('canvas');

  function draw(value) {
    if (typeof window.qrcode !== 'function') {
      root.innerHTML = '<div class="qr-code-missing">QR code unavailable</div>';
      return;
    }
    const qr = window.qrcode(0, 'M');
    qr.addData(value);
    qr.make();
    const count = qr.getModuleCount();
    const quiet = 2;                                   // white border, in modules
    const scale = Math.max(2, Math.floor((size * devicePixelRatio) / (count + quiet * 2)));
    const px = (count + quiet * 2) * scale;
    canvas.width = canvas.height = px;
    canvas.style.width = canvas.style.height = size + 'px';
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, px, px);
    ctx.fillStyle = '#101828';
    for (let r = 0; r < count; r++) {
      for (let c = 0; c < count; c++) {
        if (qr.isDark(r, c)) ctx.fillRect((c + quiet) * scale, (r + quiet) * scale, scale, scale);
      }
    }
  }

  draw(text);
  root.update = draw;
  return root;
}
