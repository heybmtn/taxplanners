// Builds a preview (with demo listings) into .lh-dist, serves it, and runs Lighthouse (mobile) on
// home, a city page and a listing page. Fails if any category scores below 100.
import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import lighthouse from 'lighthouse';
import * as chromeLauncher from 'chrome-launcher';
import { serve } from './serve.mjs';

const out = '.lh-dist';
if (!process.argv.includes('--no-build')) execSync(`npx astro build`, { stdio: 'inherit', env: { ...process.env, INCLUDE_DEMO: '1', OUT_DIR: out } });

const server = await serve(out);
const base = `http://127.0.0.1:${server.address().port}`;
// Home, search, the city of the first listing, that listing, and pricing.
const first = JSON.parse(readFileSync(`${out}/data/listings.json`, 'utf8')).listings[0];
const path = (u) => new URL(u).pathname;
const pages = ['/', '/search/', path(first.url).split('/').slice(0, -2).join('/') + '/', path(first.url), '/listing-plans/', ...process.argv.slice(2).filter((a) => a.startsWith('/'))];
const chromePath = process.env.CHROME_PATH ?? ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].find(existsSync);
const chrome = await chromeLauncher.launch({ chromePath, chromeFlags: ['--headless=new', '--no-sandbox', '--disable-gpu'] });
mkdirSync('lighthouse-reports', { recursive: true });
let failed = false;
try {
  for (const p of pages) {
    const r = await lighthouse(base + p, { port: chrome.port, output: 'html', logLevel: 'error', formFactor: 'mobile', onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'] });
    const scores = Object.values(r.lhr.categories).map((c) => [c.id, Math.round(c.score * 100)]);
    writeFileSync(`lighthouse-reports/${p.replace(/\W+/g, '_') || 'home'}.html`, r.report);
    const bad = scores.filter(([, s]) => s < 100);
    if (bad.length) {
      failed = true;
      for (const [id] of bad)
        for (const a of Object.values(r.lhr.audits)) if (a.score !== null && a.score < 1 && r.lhr.categories[id].auditRefs.some((x) => x.id === a.id && x.weight > 0)) console.log(`   ${id}: ${a.id} (${a.score}) ${a.displayValue ?? ''}`);
    }
    console.log(`${bad.length ? 'FAIL' : 'ok  '} ${p} ${scores.map(([id, s]) => `${id}=${s}`).join(' ')}`);
  }
} finally {
  await chrome.kill();
  server.close();
}
process.exit(failed ? 1 : 0);
