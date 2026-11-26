import { el, esc } from '../../utils/dom.js';
import { icon } from '../../utils/icons.js';
import { FEATURE_GROUPS } from '../../config/features.js';
import { Card } from '../card/card.js';
import { ToggleSwitch } from '../toggle-switch/toggle-switch.js';

// Step 3: all feature switches, grouped.
export function FeatureCard(store) {
  const { root, body } = Card({ step: 3, title: 'Features', subtitle: 'You can change these again in any later build' });

  for (const group of FEATURE_GROUPS) {
    const section = el(`
      <div class="feature-group">
        <div class="feature-group-title">${icon(group.icon, 15)}<span>${esc(group.title)}</span></div>
        <div class="feature-grid"></div>
      </div>`);
    const grid = section.querySelector('.feature-grid');
    for (const f of group.items) {
      grid.appendChild(ToggleSwitch(store, {
        title: f.title,
        desc: f.desc,
        badge: f.badge,
        getValue: (s) => s.features[f.key] && (!f.requires || s.features[f.requires]),
        isDisabled: (s) => !!f.requires && !s.features[f.requires],
        onChange: (v) => store.setFeature(f.key, v),
      }));
    }
    body.appendChild(section);
  }
  return root;
}
