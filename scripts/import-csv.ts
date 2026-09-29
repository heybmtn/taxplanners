// Turn a CSV into listing files: node scripts/import-csv.ts path/to/file.csv [--source "IRS directory 2026-09"]
// Columns (header row, any order): name, street, city, state, state_name, postal_code, phone, website, lat, lng, summary,
// plus one column per attribute key in site.config.ts (multi/list values separated by ";", booleans as yes/no).
// Rows missing name, city, state or summary are skipped. Dedupes on name + postcode + phone against existing files and the CSV itself.
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { attributeDefs, listingSchema } from '../src/lib/schema.ts';
import { slugify } from '../src/form/handler.ts';

const [file, ...rest] = process.argv.slice(2);
if (!file) { console.error('Usage: node scripts/import-csv.ts file.csv [--source "..."]'); process.exit(1); }
const si = rest.indexOf('--source');
const source = si >= 0 && rest[si + 1] ? rest[si + 1] : `csv import ${file.split('/').pop()}`;
const root = 'src/content/listings';
const today = new Date().toISOString().slice(0, 10);

function parseCsv(text: string): string[][] {
  const rows: string[][] = []; let row: string[] = []; let cell = ''; let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') q = false; else cell += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim()));
}

const norm = (s: unknown) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
const key = (name: unknown, postal: unknown, phone: unknown) => `${norm(name)}|${norm(postal)}|${norm(phone)}`;

const seen = new Set<string>();
if (existsSync(root)) (function walk(d: string) {
  for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) walk(p); else if (f.endsWith('.json')) { const j = JSON.parse(readFileSync(p, 'utf8')); seen.add(key(j.name, j.address?.postalCode, j.phone)); } }
})(root);

const [header, ...rows] = parseCsv(readFileSync(file, 'utf8'));
const cols = header.map((h) => h.trim().toLowerCase());
let written = 0, dupes = 0, invalid = 0;
for (const r of rows) {
  const get = (k: string) => (r[cols.indexOf(k)] ?? '').trim();
  const k = key(get('name'), get('postal_code'), get('phone'));
  if (seen.has(k)) { dupes++; continue; }
  const attributes: Record<string, unknown> = {};
  for (const [a, def] of Object.entries(attributeDefs)) {
    const v = get(a); if (!v) continue;
    if (def.type === 'bool') attributes[a] = /^(y|yes|true|1)$/i.test(v);
    else attributes[a] = v.split(';').map((s) => s.trim()).filter(Boolean);
  }
  const listing = {
    name: get('name'), slug: slugify(get('name')), status: 'published', tier: 'basic',
    address: { street: get('street') || null, locality: get('city'), region: get('state'), postalCode: get('postal_code') || null, country: 'US' },
    lat: get('lat') ? Number(get('lat')) : null, lng: get('lng') ? Number(get('lng')) : null,
    phone: get('phone') || null, website: get('website') || null, sameAs: [], hours: {},
    summary: get('summary'), attributes, lastUpdated: today, source,
  };
  const parsed = listingSchema.safeParse(listing);
  if (!parsed.success) { invalid++; console.warn(`skip "${listing.name}": ${parsed.error.issues.map((i) => `${i.path.join('.')} ${i.message}`).join('; ')}`); continue; }
  const dir = join(root, slugify(get('state_name') || get('state')), slugify(get('city')));
  mkdirSync(dir, { recursive: true });
  let slug = listing.slug; let n = 2;
  while (existsSync(join(dir, `${slug}.json`))) slug = `${listing.slug}-${n++}`;
  writeFileSync(join(dir, `${slug}.json`), JSON.stringify({ ...listing, slug }, null, 2) + '\n');
  seen.add(k); written++;
}
console.log(`written ${written}, duplicates skipped ${dupes}, invalid skipped ${invalid}`);
