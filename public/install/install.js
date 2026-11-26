import { getBuild, downloadUrl, ApiError } from '../services/api.js';
import { esc } from '../utils/dom.js';
import { icon } from '../utils/icons.js';

// Phone install page opened from the QR code: /install/<buildId>
const root = document.getElementById('install');
const id = location.pathname.split('/').filter(Boolean)[1] || '';
const formatSize = (b) => (b >= 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.round(b / 1024) + ' KB');

const STEPS = [
  ['Tap <b>Download APK</b>', 'The file is saved to your Downloads.'],
  ['Open the downloaded file', 'Tap the notification, or find it in the Files app.'],
  ['Allow installing', 'If asked, turn on <b>Allow from this source</b> for your browser, then go back.'],
  ['Tap <b>Install</b>', 'If Play Protect warns you, tap <b>More details → Install anyway</b>.'],
];

function renderState(kind, title, text, retry) {
  root.innerHTML = `
    <div class="install-state install-${kind}">
      <span class="install-state-icon">${icon(kind === 'error' ? 'alert' : 'info', 28, 1.8)}</span>
      <b>${esc(title)}</b>
      <p>${esc(text)}</p>
      ${retry ? `<button type="button" class="btn btn-secondary">${icon('refresh', 15)}Try again</button>` : ''}
    </div>`;
  if (retry) root.querySelector('button').addEventListener('click', load);
}

function renderApp(job) {
  const iconSrc = job.hasIcon ? `/icon/${encodeURIComponent(id)}` : '';
  document.title = `Install ${job.appName}`;
  root.innerHTML = `
    <div class="install-card">
      ${iconSrc ? `<img class="install-icon" src="${iconSrc}" alt="">` : `<div class="install-icon install-icon-letter">${esc((job.appName || 'A')[0])}</div>`}
      <h1>${esc(job.appName)}</h1>
      <p class="install-meta">Version ${esc(job.versionName)} · ${formatSize(job.size)}</p>
      <a class="btn btn-success btn-lg" href="${downloadUrl(id)}" download="${esc(job.fileName)}">${icon('download', 18, 2.3)}Download APK</a>
      <p class="install-package">${esc(job.packageName)}</p>
    </div>
    <div class="install-steps">
      <h2>How to install</h2>
      <ol>${STEPS.map(([t, d], i) => `<li><span class="install-step-num">${i + 1}</span><span><b class="install-step-title">${t}</b><span class="install-step-desc">${d}</span></span></li>`).join('')}</ol>
    </div>`;
}

async function load() {
  root.innerHTML = '<div class="install-state install-loading"><span class="spinner dark"></span><span>Loading app…</span></div>';
  if (!id) return renderState('error', 'Link is incomplete', 'Scan the QR code again from the Web2APK page.');
  try {
    const job = await getBuild(id);
    if (job.status === 'done') return renderApp(job);
    if (job.status === 'error') return renderState('error', 'This build failed', 'Go back to the computer and build the app again.');
    renderState('info', 'Still building…', 'The app isn\'t ready yet. This page will refresh automatically.');
    setTimeout(load, 3000);
  } catch (err) {
    if (err instanceof ApiError && err.kind === 'server' && /not found/i.test(err.message)) {
      return renderState('error', 'App not found', 'This link has expired or the build was deleted. Build the app again and scan the new QR code.');
    }
    renderState('error', 'Can\'t reach your computer', 'Make sure this phone is on the same Wi-Fi as the computer and that Web2APK is still running.', true);
  }
}

load();
