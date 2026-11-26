// Estimates build progress from the server log lines.
export const STAGES = ['Prepare', 'Compile', 'Optimize', 'Sign', 'Done'];

const RULES = [
  { test: /Queued|Preparing/, stage: 0, label: 'Preparing project…', pct: 6 },
  { test: /ad-block list/i, stage: 0, label: 'Getting the latest ad-block list…', pct: 12 },
  { test: /Compiling|preBuild/, stage: 1, label: 'Compiling Kotlin code…', pct: 20 },
  { test: /compileReleaseKotlin|Javac/, stage: 1, label: 'Compiling Kotlin code…', pct: 45 },
  { test: /minify|R8/, stage: 2, label: 'Optimizing and shrinking…', pct: 70 },
  { test: /packageRelease/, stage: 3, label: 'Signing the APK…', pct: 90 },
  { test: /APK ready/, stage: 4, label: 'Done', pct: 100 },
];

export function progressFromLog(lines) {
  let current = RULES[0];
  for (const line of lines) {
    for (const rule of RULES) if (rule.test.test(line) && rule.pct >= current.pct) current = rule;
  }
  const tasks = lines.filter((l) => l.startsWith('> Task')).length;
  const pct = current.stage === 4 ? 100 : Math.max(current.pct, Math.min(95, 15 + tasks * 1.5));
  return { stage: current.stage, label: current.label, pct };
}
