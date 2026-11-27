import { el, esc } from '../../utils/dom.js';
import { icon } from '../../utils/icons.js';
import { validateForm } from '../../utils/validation.js';

const SLIDE_MS = 320;
const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Step-by-step form: one step on screen at a time, Back / Next slide between them.
 * steps: [{ id, label, title, subtitle, icon, optional, fields, content, onLeave(store) }]
 *   fields: fieldErrors keys checked before leaving the step (from validateForm).
 * Returns { root, goTo(id), showErrors(fieldErrors) }.
 */
export function Wizard(store, steps) {
  const root = el(`
    <section class="card wizard">
      <div class="wizard-head">
        <div class="wizard-meta">
          <span class="wizard-count"></span>
          <button type="button" class="wizard-skip">Skip to build${icon('arrowRight', 14)}</button>
        </div>
        <div class="wizard-bar"><span></span></div>
        <ol class="wizard-steps">
          ${steps.map((s, i) => `
            <li><button type="button" class="wizard-step" data-index="${i}" aria-label="Step ${i + 1}: ${esc(s.title)}">
              <span class="wizard-step-dot">${icon(s.icon, 15)}</span><span class="wizard-step-label">${esc(s.label)}</span>
            </button></li>`).join('')}
        </ol>
      </div>
      <div class="wizard-viewport"></div>
      <div class="wizard-foot">
        <button type="button" class="btn btn-secondary wizard-back">${icon('arrowLeft', 16)}Back</button>
        <span class="wizard-foot-msg" aria-live="polite"></span>
        <button type="button" class="btn btn-primary wizard-next"><span class="wizard-next-text">Next</span>${icon('arrowRight', 16)}</button>
      </div>
    </section>`);

  const viewport = root.querySelector('.wizard-viewport');
  const count = root.querySelector('.wizard-count');
  const bar = root.querySelector('.wizard-bar span');
  const stepButtons = [...root.querySelectorAll('.wizard-step')];
  const back = root.querySelector('.wizard-back');
  const next = root.querySelector('.wizard-next');
  const nextText = root.querySelector('.wizard-next-text');
  const skip = root.querySelector('.wizard-skip');
  const footMsg = root.querySelector('.wizard-foot-msg');

  // one panel per step: title + the step's content (its own card chrome is hidden by CSS)
  const panels = steps.map((s, i) => {
    const panel = el(`
      <div class="wizard-panel" role="group" aria-label="${esc(s.title)}" hidden>
        <div class="wizard-panel-head">
          <h2 class="wizard-title" tabindex="-1">${esc(s.title)}${s.optional ? '<span class="wizard-optional">Optional</span>' : ''}</h2>
          ${s.subtitle ? `<p class="wizard-subtitle">${esc(s.subtitle)}</p>` : ''}
          ${s.optional && !s.isSkipped ? '<p class="wizard-defaults">The defaults suit most websites. Change what you like, or press Next.</p>' : ''}
        </div>
      </div>`);
    panel.appendChild(s.content);
    s.content.querySelectorAll?.('details').forEach((d) => { d.open = true; });
    if (s.content.tagName === 'DETAILS') s.content.open = true;
    viewport.appendChild(panel);
    panel.dataset.index = i;
    return panel;
  });

  let current = 0;
  let furthest = 0;
  let animating = null;

  function stepErrors(i, all) {
    const out = {};
    for (const key of steps[i].fields || []) if (all[key]) out[key] = all[key];
    return out;
  }

  /** Checks steps from..to-1. Returns the index of the first step with errors, or -1. */
  function firstInvalid(from, to) {
    const all = validateForm(store.get());
    for (let i = from; i < to; i++) {
      const errs = stepErrors(i, all);
      if (Object.keys(errs).length) {
        store.set({ fieldErrors: { ...store.get().fieldErrors, ...errs } });
        return i;
      }
    }
    return -1;
  }

  function focusFirstError(panel) {
    const target = panel.querySelector('.has-error input, .has-error select, .url-bad .url-link');
    if (target) {
      target.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'center' });
      target.focus({ preventScroll: true });
    }
  }

  function flagError() {
    footMsg.textContent = 'Fix the highlighted field to continue';
    next.classList.remove('is-shaking');
    void next.offsetWidth;   // restart the animation
    next.classList.add('is-shaking');
  }

  /** Shows step `to`. Going forward checks every step on the way; it stops at the first one with a problem. */
  function show(to, { check = true } = {}) {
    to = Math.max(0, Math.min(steps.length - 1, to));
    if (to === current && !panels[to].hidden) return;
    if (check && to > current) {
      const bad = firstInvalid(current, to);
      if (bad !== -1) {
        if (bad === current) { flagError(); focusFirstError(panels[current]); return; }
        to = bad;
      }
    }
    for (let i = current; i < to; i++) steps[i].onLeave?.(store);
    footMsg.textContent = '';

    const from = current;
    const dir = to > from ? 'next' : 'prev';
    current = to;
    furthest = Math.max(furthest, to);
    slide(panels[from], panels[to], dir);
    render();

    // keep the wizard's top in view and move focus to the new step's title
    const top = root.getBoundingClientRect().top;
    if (top < 0 || top > window.innerHeight * 0.5) root.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' });
    panels[to].querySelector('.wizard-title').focus({ preventScroll: true });
    if (Object.keys(stepErrors(to, store.get().fieldErrors)).length) setTimeout(() => focusFirstError(panels[to]), SLIDE_MS);
  }

  function slide(oldPanel, newPanel, dir) {
    if (animating) animating();   // finish a slide that is still running
    if (oldPanel === newPanel || reducedMotion()) {
      panels.forEach((p) => { p.hidden = p !== newPanel; });
      return;
    }
    const startHeight = viewport.offsetHeight;
    oldPanel.classList.add('is-leaving', `to-${dir}`);
    newPanel.hidden = false;
    newPanel.classList.add('is-entering', `from-${dir}`);
    const endHeight = newPanel.offsetHeight;
    viewport.style.height = startHeight + 'px';
    void viewport.offsetHeight;
    viewport.classList.add('is-sliding');
    viewport.style.height = endHeight + 'px';

    const done = () => {
      clearTimeout(timer);
      animating = null;
      oldPanel.hidden = true;
      oldPanel.classList.remove('is-leaving', 'to-next', 'to-prev');
      newPanel.classList.remove('is-entering', 'from-next', 'from-prev');
      viewport.classList.remove('is-sliding');
      viewport.style.height = '';
    };
    const timer = setTimeout(done, SLIDE_MS + 40);
    animating = done;
  }

  function render() {
    const s = steps[current];
    const last = current === steps.length - 1;
    count.innerHTML = `Step ${current + 1} of ${steps.length}<span> · ${esc(s.label)}</span>`;
    bar.style.width = `${((current + 1) / steps.length) * 100}%`;
    stepButtons.forEach((b, i) => {
      b.classList.toggle('is-current', i === current);
      b.classList.toggle('is-done', i < current || (i <= furthest && i !== current));
      if (i === current) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current');
    });
    back.disabled = current === 0;
    next.hidden = last;
    skip.hidden = last || current < 1;
    const after = steps[current + 1];
    if (after) {
      const skipping = s.optional && s.isSkipped?.(store.get());
      nextText.textContent = skipping ? `Skip · ${after.label}` : `Next: ${after.label}`;
    }
  }

  next.addEventListener('click', () => show(current + 1));
  back.addEventListener('click', () => show(current - 1));
  skip.addEventListener('click', () => show(steps.length - 1));
  next.addEventListener('animationend', () => next.classList.remove('is-shaking'));
  stepButtons.forEach((b) => b.addEventListener('click', () => show(Number(b.dataset.index))));

  // the "Skip" / "Next" label of optional steps follows what is switched on
  store.subscribe(() => {
    render();
    if (footMsg.textContent && !Object.keys(stepErrors(current, store.get().fieldErrors)).length) footMsg.textContent = '';
  });

  panels[0].hidden = false;
  render();

  const indexOf = (id) => steps.findIndex((s) => s.id === id);
  return {
    root,
    goTo: (id) => show(indexOf(id), { check: false }),
    /** Opens the first step that has one of these field errors (used by the Build button). */
    showErrors(fieldErrors) {
      const i = steps.findIndex((s) => (s.fields || []).some((k) => fieldErrors[k]));
      if (i === -1) return;
      if (i === current) focusFirstError(panels[i]);
      else show(i, { check: false });
    },
  };
}
