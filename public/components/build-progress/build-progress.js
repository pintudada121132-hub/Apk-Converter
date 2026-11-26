import { el } from '../../utils/dom.js';
import { icon } from '../../utils/icons.js';
import { STAGES, progressFromLog } from '../../services/build-stages.js';

// Progress bar + stage list + elapsed timer + collapsible build log.
export function BuildProgress() {
  const root = el(`
    <div class="build-progress" hidden>
      <div class="build-progress-top"><span class="build-progress-label">Starting…</span><span class="build-progress-time">0s</span></div>
      <div class="build-progress-bar"><div></div></div>
      <ol class="build-progress-stages">${STAGES.map((s) => `<li><span class="stage-dot">${icon('check', 10, 3)}</span>${s}</li>`).join('')}</ol>
      <button type="button" class="build-log-toggle">${icon('chevronRight', 13)}<span>Show build log</span></button>
      <pre class="build-log" hidden></pre>
    </div>`);

  const label = root.querySelector('.build-progress-label');
  const time = root.querySelector('.build-progress-time');
  const fill = root.querySelector('.build-progress-bar > div');
  const stages = [...root.querySelectorAll('.build-progress-stages li')];
  const log = root.querySelector('.build-log');
  const toggle = root.querySelector('.build-log-toggle');
  let timer = null;

  toggle.addEventListener('click', () => setLogOpen(log.hidden));
  function setLogOpen(open) {
    log.hidden = !open;
    toggle.classList.toggle('open', open);
    toggle.querySelector('span').textContent = open ? 'Hide build log' : 'Show build log';
  }

  return {
    root,
    start() {
      root.hidden = false;
      root.classList.remove('is-failed');
      fill.style.width = '3%';
      label.textContent = 'Sending to the build server…';
      log.textContent = '';
      stages.forEach((s) => s.classList.remove('done', 'current'));
      const started = Date.now();
      clearInterval(timer);
      time.textContent = '0s';
      timer = setInterval(() => { time.textContent = Math.round((Date.now() - started) / 1000) + 's'; }, 500);
    },
    update(job) {
      const p = progressFromLog(job.log);
      label.textContent = job.position > 0 ? `Waiting in queue (position ${job.position})…` : p.label;
      fill.style.width = p.pct + '%';
      stages.forEach((s, i) => {
        s.classList.toggle('done', i < p.stage || p.stage === STAGES.length - 1);
        s.classList.toggle('current', i === p.stage && p.stage !== STAGES.length - 1);
      });
      const atBottom = log.scrollTop + log.clientHeight >= log.scrollHeight - 20;
      log.textContent = job.log.join('\n');
      if (atBottom) log.scrollTop = log.scrollHeight;
    },
    fail() {
      clearInterval(timer);
      root.classList.add('is-failed');
      label.textContent = 'Build failed';
      setLogOpen(true);
      log.scrollTop = log.scrollHeight;
    },
    hide() {
      clearInterval(timer);
      root.hidden = true;
      setLogOpen(false);
    },
  };
}
