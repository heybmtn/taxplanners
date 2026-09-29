// Deletes every listing file marked "demo": true.
import { readdirSync, readFileSync, statSync, unlinkSync, rmdirSync } from 'node:fs';
import { join } from 'node:path';
let n = 0;
(function walk(d) {
  for (const f of readdirSync(d)) {
    const p = join(d, f);
    if (statSync(p).isDirectory()) { walk(p); if (!readdirSync(p).length) rmdirSync(p); }
    else if (f.endsWith('.json') && JSON.parse(readFileSync(p, 'utf8')).demo === true) { unlinkSync(p); n++; }
  }
})('src/content/listings');
console.log(`removed ${n} demo listing(s)`);
