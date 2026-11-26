import { el } from '../../utils/dom.js';
import { icon } from '../../utils/icons.js';
import { startBuild, getBuild } from '../../services/api.js';
import { buildPayload } from '../../services/build-payload.js';
import { validateForm } from '../../utils/validation.js';
import { BuildProgress } from '../build-progress/build-progress.js';
import { ErrorBox } from '../error-box/error-box.js';
import { ResultCard } from '../result-card/result-card.js';

const POLL_MS = 1000;
const MAX_POLL_FAILURES = 5;

// Build button + the whole build flow: validate → send → progress → success (QR) or error (retry).
export function BuildPanel(store) {
  const root = el(`
    <section class="card build-panel">
      <div class="card-body">
        <button type="button" class="btn btn-primary btn-lg build-button">
          <span class="build-button-icon">${icon('wrench', 18)}</span><span class="build-button-text">Build APK</span>
        </button>
        <p class="build-panel-hint">Usually takes 30–60 seconds. The first build can take a few minutes.</p>
      </div>
    </section>`);
  const body = root.querySelector('.card-body');
  const button = root.querySelector('.build-button');
  const buttonIcon = root.querySelector('.build-button-icon');
  const buttonText = root.querySelector('.build-button-text');

  const errors = ErrorBox();
  const progress = BuildProgress();
  const result = ResultCard({ onBuildAnother: buildAnother });
  body.append(errors.root, progress.root, result.root);

  let busy = false;
  let showingFieldErrors = false;

  // hide the "fix the highlighted fields" summary once every field error is fixed
  store.subscribe((s) => {
    if (showingFieldErrors && !Object.values(s.fieldErrors).some(Boolean)) {
      showingFieldErrors = false;
      errors.hide();
    }
  });

  function setBusy(value) {
    busy = value;
    button.disabled = value;
    buttonText.textContent = value ? 'Building…' : 'Build APK';
    buttonIcon.innerHTML = value ? '<span class="spinner"></span>' : icon('wrench', 18);
  }

  function scrollToFirstError(fieldErrors) {
    const first = Object.keys(fieldErrors)[0];
    const node = document.querySelector(`[data-field="${first}"]`);
    const target = node?.querySelector('.url-bad') || node; // a wrong row in the website list
    target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    (target?.querySelector('.url-link') || target?.querySelector('input'))?.focus({ preventScroll: true });
  }

  async function run() {
    if (busy) return;
    showingFieldErrors = false;
    errors.hide();
    result.hide();

    const state = store.get();
    if (state.server.checked && state.server.online && !state.server.sdk) {
      errors.show({ title: 'Android SDK not found', messages: ['Install Android Studio (or the Android SDK) on this computer, or set the ANDROID_HOME environment variable, then restart start.bat.'] });
      return;
    }
    const fieldErrors = validateForm(state);
    if (Object.keys(fieldErrors).length) {
      store.set({ fieldErrors });
      errors.show({ title: 'Please fix the highlighted fields', messages: Object.values(fieldErrors) });
      showingFieldErrors = true;
      scrollToFirstError(fieldErrors);
      return;
    }
    store.set({ fieldErrors: {} });

    setBusy(true);
    progress.start();
    const payload = buildPayload(state);
    try {
      const { id } = await startBuild(payload);
      const job = await waitForBuild(id);
      progress.hide();
      result.show({ id, job, iconDataUrl: payload.iconPreview, lan: store.get().server.lan });
    } catch (err) {
      if (err.kind === 'validation') {
        progress.hide();
        errors.show({ title: 'Please check your details', messages: err.list });
      } else {
        progress.fail();
        errors.show({ title: err.title || 'Something went wrong', messages: [err.message], retry: run });
      }
    } finally {
      setBusy(false);
    }
  }

  async function waitForBuild(id) {
    let failures = 0;
    for (;;) {
      let job;
      try {
        job = await getBuild(id);
        failures = 0;
      } catch (err) {
        if (++failures >= MAX_POLL_FAILURES) throw err;   // server went away
        await sleep(POLL_MS * 2);
        continue;
      }
      progress.update(job);
      if (job.status === 'done') return job;
      if (job.status === 'error') {
        const last = (job.log[job.log.length - 1] || '').replace(/^ERROR:\s*/, '');
        throw Object.assign(new Error(friendlyBuildError(last)), { title: 'The build failed' });
      }
      await sleep(POLL_MS);
    }
  }

  function buildAnother() {
    result.hide();
    const code = (parseInt(store.get().versionCode, 10) || 1) + 1;
    store.set({ versionCode: String(code) });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  button.addEventListener('click', run);
  return root;
}

function friendlyBuildError(raw) {
  if (/SDK/i.test(raw)) return raw;
  if (/Gradle build failed/i.test(raw)) return 'The Android build tools reported an error. Open the build log below for details, then try again.';
  return (raw || 'Unknown error') + ' — see the build log below for details.';
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
