// Checks WCAG AA (4.5:1) for every text/background pair declared in src/theme.css.
import { readFileSync } from 'node:fs';
const css = readFileSync(new URL('../src/theme.css', import.meta.url), 'utf8');
const vars = Object.fromEntries([...css.matchAll(/--([\w-]+):\s*(#[0-9a-f]{6})/gi)].map((m) => [m[1], m[2]]));
const lum = (hex) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const pairs = [...css.matchAll(/contrast-pair:\s*([\w-]+)\s+on\s+([\w-]+)/g)].map((m) => [m[1], m[2]]);
let bad = 0;
for (const [fg, bg] of pairs) {
  const r = ratio(vars[fg], vars[bg]);
  const ok = r >= 4.5;
  if (!ok) bad++;
  console.log(`${ok ? 'ok ' : 'BAD'} ${fg} on ${bg}: ${r.toFixed(2)}`);
}
if (!pairs.length || bad) process.exit(1);
