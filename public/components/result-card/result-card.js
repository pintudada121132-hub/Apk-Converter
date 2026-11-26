import { el, esc } from '../../utils/dom.js';
import { icon } from '../../utils/icons.js';
import { downloadUrl } from '../../services/api.js';
import { copyText } from '../../utils/clipboard.js';
import { QrCode } from '../qr-code/qr-code.js';
import { toast } from '../toast/toast.js';

const formatSize = (bytes) => (bytes >= 1024 * 1024 ? (bytes / 1024 / 1024).toFixed(1) + ' MB' : Math.round(bytes / 1024) + ' KB');

/**
 * Success state: app summary, download button, and a QR code the phone can scan to install.
 * show({ id, job, iconDataUrl, lan }) / hide(). onBuildAnother is called by the "Build another" button.
 */
export function ResultCard({ onBuildAnother }) {
  const root = el('<div class="result-card" hidden></div>');

  function show({ id, job, iconDataUrl, lan }) {
    const hasLan = lan.length > 0;
    root.innerHTML = `
      <div class="result-main">
        <div class="result-status">${icon('checkCircle', 18)}<span>Your app is ready</span></div>
        <div class="result-app">
          <img class="result-icon" src="${iconDataUrl}" alt="">
          <div class="result-app-text">
            <b>${esc(job.appName)}</b>
            <span>${esc(job.packageName)}</span>
            <span>Version ${esc(job.versionName)} · ${formatSize(job.size)}</span>
          </div>
        </div>
        <div class="result-actions">
          <a class="btn btn-success" href="${downloadUrl(id)}" download="${esc(job.fileName)}">${icon('download', 17, 2.3)}Download APK</a>
          <button type="button" class="btn btn-secondary result-another">${icon('plus', 16)}Build another</button>
        </div>
        <p class="result-hint">To update an app that's already installed, build again with the same package name and a higher build number. "Build another" raises it for you.</p>
      </div>
      <div class="result-qr">
        ${hasLan ? `
          <div class="result-qr-code"></div>
          <b>Scan to install on your phone</b>
          <p>Open the phone's camera and point it at the code. The phone must be on the same Wi-Fi as this computer.</p>
          ${lan.length > 1 ? `<select class="input result-lan" aria-label="Network address">${lan.map((u) => `<option value="${esc(u)}">${esc(u.replace(/^https?:\/\//, ''))}</option>`).join('')}</select>` : ''}
          <button type="button" class="btn btn-secondary btn-sm result-copy">${icon('copy', 14)}Copy phone link</button>
        ` : `
          <div class="result-qr-empty">${icon('wifi', 28, 1.6)}</div>
          <b>QR install needs Wi-Fi</b>
          <p>This computer isn't connected to a local network, so a phone can't reach it. Download the APK and copy it to your phone instead.</p>
        `}
      </div>`;

    root.querySelector('.result-another').addEventListener('click', onBuildAnother);

    if (hasLan) {
      const installLink = (base) => `${base}/install/${id}`;
      let current = installLink(lan[0]);
      const qr = QrCode(current, 168);
      root.querySelector('.result-qr-code').appendChild(qr);
      root.querySelector('.result-lan')?.addEventListener('change', (e) => {
        current = installLink(e.target.value);
        qr.update(current);
      });
      root.querySelector('.result-copy').addEventListener('click', async () => {
        (await copyText(current)) ? toast('Phone link copied') : toast('Couldn\'t copy the link', 'error');
      });
    }

    root.hidden = false;
    root.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  return { root, show, hide: () => { root.hidden = true; root.innerHTML = ''; } };
}
