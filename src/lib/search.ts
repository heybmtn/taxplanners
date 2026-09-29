// Search and filtering over the public listing JSON (/data/listings.json).
// Pure and dependency-free: the Worker uses it to filter the /search/ page; tests use it directly.
import site from '../../site.config.ts';
import { attributeDefs } from './schema.ts';

export type SearchListing = {
  slug: string;
  region: string;
  city: string;
  name: string;
  tier: 'basic' | 'verified';
  address: { locality: string; region: string; postalCode?: string | null };
  attributes: Record<string, unknown>;
};

export type Query = {
  location: string;
  state: string;
  attrs: Record<string, string[]>;
  meeting: string[];
  languages: string[];
  verified: boolean;
  page: number;
};

export const PAGE_SIZE = 20;
export const multiAttrs = Object.entries(attributeDefs).filter(([, d]) => d.type === 'multi').map(([k]) => k);
export const meetingKeys = Object.keys(site.meetingFormats);

const words = (s: string) =>
  s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);

const clean = (v: string | null, max = 80) => (v ?? '').trim().slice(0, max);

export function parseQuery(sp: URLSearchParams): Query {
  const attrs: Record<string, string[]> = {};
  const add = (attr: string, key: string) => {
    const def = attributeDefs[attr];
    if (def?.type === 'multi' && key in def.options) (attrs[attr] ??= []).includes(key) || attrs[attr].push(key);
  };
  for (const attr of multiAttrs) for (const v of sp.getAll(attr).slice(0, 20)) add(attr, v);
  const need = clean(sp.get('need'));
  if (need.includes(':')) add(need.split(':')[0], need.split(':')[1]);
  const page = Math.min(Math.max(parseInt(sp.get('page') ?? '1', 10) || 1, 1), 1000);
  return {
    // Place names only: letters, digits, spaces and , . ' - (the value is echoed back into the page).
    location: clean(sp.get('location')).replace(/[^\p{L}\p{N} ,.'-]/gu, '').replace(/\s+/g, ' ').trim(),
    state: clean(sp.get('state'), 40).toLowerCase().replace(/[^a-z0-9-]/g, ''),
    attrs,
    meeting: sp.getAll('meeting').filter((m) => meetingKeys.includes(m)),
    languages: sp.getAll('languages').map((l) => clean(l, 40).replace(/[^\p{L} -]/gu, '')).filter(Boolean).slice(0, 10),
    verified: sp.get('verified') === '1',
    page,
  };
}

export function isEmptyQuery(q: Query): boolean {
  return !q.location && !q.state && !Object.keys(q.attrs).length && !q.meeting.length && !q.languages.length && !q.verified;
}

/** Every word typed must match the listing's city, state, state abbreviation or ZIP; the last word may be a prefix. */
export function matchesLocation(l: SearchListing, location: string): boolean {
  const typed = words(location);
  if (!typed.length) return true;
  const zip = (l.address.postalCode ?? '').slice(0, 5);
  const own = new Set([...words(l.address.locality), ...words(l.region), l.address.region.toLowerCase(), ...(zip ? [zip] : [])]);
  return typed.every((w, i) => own.has(w) || (i === typed.length - 1 && w.length >= 3 && !/^\d+$/.test(w) && [...own].some((o) => o.startsWith(w))));
}

export function matches(l: SearchListing, q: Query): boolean {
  if (q.verified && l.tier !== 'verified') return false;
  if (q.state && l.region !== q.state) return false;
  if (!matchesLocation(l, q.location)) return false;
  for (const [attr, keys] of Object.entries(q.attrs)) {
    const have = (l.attributes[attr] as string[] | undefined) ?? [];
    if (!keys.some((k) => have.includes(k))) return false;
  }
  if (q.meeting.length && !q.meeting.some((m) => l.attributes[m] === true)) return false;
  if (q.languages.length) {
    const have = ((l.attributes.languages as string[] | undefined) ?? []).map((x) => x.toLowerCase());
    if (!q.languages.some((x) => have.includes(x.toLowerCase()))) return false;
  }
  return true;
}

/** Keeps the input order (the listings file is already sorted Verified first, then completeness, then A–Z). */
export function search<T extends SearchListing>(listings: T[], q: Query) {
  const all = listings.filter((l) => matches(l, q));
  const pages = Math.max(1, Math.ceil(all.length / PAGE_SIZE));
  const page = Math.min(q.page, pages);
  return { total: all.length, page, pages, results: all.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE) };
}

/** Query string for a query, optionally with one value removed or the page changed. */
export function toParams(q: Query, change: { remove?: [string, string]; page?: number } = {}): string {
  const sp = new URLSearchParams();
  const skip = (name: string, value: string) => change.remove?.[0] === name && change.remove?.[1] === value;
  if (q.location && !skip('location', q.location)) sp.set('location', q.location);
  if (q.state && !skip('state', q.state)) sp.set('state', q.state);
  for (const [attr, keys] of Object.entries(q.attrs)) for (const k of keys) if (!skip(attr, k)) sp.append(attr, k);
  for (const m of q.meeting) if (!skip('meeting', m)) sp.append('meeting', m);
  for (const l of q.languages) if (!skip('languages', l)) sp.append('languages', l);
  if (q.verified && !skip('verified', '1')) sp.set('verified', '1');
  if (change.page && change.page > 1) sp.set('page', String(change.page));
  const s = sp.toString();
  return s ? `?${s}` : '';
}

/** Human labels for the active filters, each with the value needed to remove it. */
export function activeFilters(q: Query, stateNames: Record<string, string> = {}): { label: string; remove: [string, string] }[] {
  const out: { label: string; remove: [string, string] }[] = [];
  if (q.location) out.push({ label: `Near "${q.location}"`, remove: ['location', q.location] });
  if (q.state) out.push({ label: stateNames[q.state] ?? q.state, remove: ['state', q.state] });
  for (const [attr, keys] of Object.entries(q.attrs)) {
    const def = attributeDefs[attr];
    if (def.type === 'multi') for (const k of keys) out.push({ label: def.options[k], remove: [attr, k] });
  }
  for (const m of q.meeting) out.push({ label: (site.meetingFormats as Record<string, string>)[m], remove: ['meeting', m] });
  for (const l of q.languages) out.push({ label: l, remove: ['languages', l] });
  if (q.verified) out.push({ label: 'Verified only', remove: ['verified', '1'] });
  return out;
}
