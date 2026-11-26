import { el } from '../../utils/dom.js';
import { icon } from '../../utils/icons.js';

// Page title, one-line explanation and the key selling points.
export function PageIntro() {
  const points = [
    ['shield', 'Ads & redirects blocked'],
    ['phone', 'Fits any screen'],
    ['qr', 'Install by QR code'],
    ['download', 'Signed and ready to install'],
  ];
  return el(`
    <div class="page-intro">
      <h1>Turn any website into an Android app</h1>
      <p>Paste a link, pick the features you want, and get a signed APK in about a minute.</p>
      <ul class="page-intro-points">
        ${points.map(([i, t]) => `<li>${icon(i, 15)}<span>${t}</span></li>`).join('')}
      </ul>
    </div>`);
}
