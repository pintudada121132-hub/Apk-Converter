import { el, esc } from '../../utils/dom.js';
import { icon } from '../../utils/icons.js';
import { FEATURE_GROUPS } from '../../config/features.js';
import { Card } from '../card/card.js';
import { ToggleSwitch } from '../toggle-switch/toggle-switch.js';

// Feature switches, grouped. groups: titles of the groups to show (default: all of them).
export function FeatureCard(store, { groups } = {}) {
  const { root, body } = Card({ step: 3, title: 'Features', subtitle: 'You can change these again in any later build' });
  const shown = groups ? FEATURE_GROUPS.filter((g) => groups.includes(g.title)) : FEATURE_GROUPS;

  for (const group of shown) {
    const section = el(`
      <div class="feature-group">
        ${shown.length > 1 ? `<div class="feature-group-title">${icon(group.icon, 15)}<span>${esc(group.title)}</span></div>` : ''}
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
