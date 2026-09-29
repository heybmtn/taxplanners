// Post-build checks on the generated site (dist/ or $OUT_DIR):
// 1. Tier wording: every "verif…" word in visible text is exactly the tier name "Verified"; business JSON-LD never mentions it.
// 2. An expired Verified listing renders as Basic (checked on the demo listing when demos are built).
// 3. Data files and markdown twins are never linked visibly; the for-sale banner is on the home page only.
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const dir = process.env.OUT_DIR ?? 'dist';
const files = [];
(function walk(d) { for (const f of readdirSync(d)) { const p = join(d, f); statSync(p).isDirectory() ? walk(p) : files.push(p); } })(dir);

const errors = [];
for (const f of files.filter((f) => /\.(html|md|txt)$/.test(f))) {
  const src = readFileSync(f, 'utf8');
  let text = src;
  if (f.endsWith('.html')) {
    for (const m of src.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) if (/verif/i.test(m[1]) && !m[1].includes('"FAQPage"')) errors.push(`${f}: JSON-LD mentions verification`);
    text = src.replace(/<(script|style)[\s\S]*?<\/\1>/g, ' ').replace(/<[^>]+>/g, ' ');
    const body = src.split('<body')[1] ?? '';
    for (const m of body.matchAll(/<a [^>]*href="([^"]+)"/g)) if (/^\/data\/|\/data\/|\.md$|\.json$/.test(m[1])) errors.push(`${f}: visible link to agent file ${m[1]}`);
    const banner = src.includes('class="banner"');
    const isHome = f === join(dir, 'index.html');
    if (banner !== isHome) errors.push(`${f}: for-sale banner ${banner ? 'present' : 'missing'}`);
  } else if (f.endsWith('robots.txt')) continue;
  // Ignore URLs (?tier=verified) and code spans (field names in data docs).
  text = text.replace(/https?:\/\/\S+|\?tier=verified/g, ' ').replace(/`[^`]*`/g, ' ');
  for (const m of text.matchAll(/[A-Za-z]*verif[A-Za-z]*/gi)) if (m[0] !== 'Verified') errors.push(`${f}: tier wording "${m[0]}" (use the tier name "Verified" only)`);
}
if (files.some((f) => f.endsWith('.md') && readFileSync(f, 'utf8').includes('This domain is for sale'))) errors.push('for-sale banner text in markdown');
if (readFileSync(join(dir, 'llms.txt'), 'utf8').includes('for sale')) errors.push('for-sale text in llms.txt');

const expired = join(dir, 'tax-planners/texas/austin/demo-tax-planner-2/index.html');
if (existsSync(expired)) {
  const h = readFileSync(expired, 'utf8');
  if (h.includes('class="badge"') || h.includes('must not render') || h.includes('example.com/expired')) errors.push('expired Verified demo listing renders as Verified');
  if (!h.includes('Get it Verified or send a correction')) errors.push('expired Verified demo listing lacks the Basic call to action');
  const md = readFileSync(expired.replace('index.html', 'index.md'), 'utf8');
  if (!md.includes('Tier: Basic')) errors.push('expired Verified demo twin is not Basic');
  console.log('ok expired Verified listing renders as Basic');
}

if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
console.log(`ok ${files.length} output files checked (tier wording, agent links, banner)`);
