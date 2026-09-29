// Titles, descriptions, breadcrumbs and indexability for every data-driven page, in one place.
// HTML routes, markdown twins and data files all read from here.
import site from '../../site.config.ts';
import { attributeDefs } from './schema.ts';
import { hubUrl, isIndexable, loadData, type City, type Entry, type Facet, type Region, type Term } from './data.ts';
import { cap, monthYear, plural } from './format.ts';
import { today } from './tier.ts';
import type { Crumb } from './seo.ts';

const S = site.entity;
const clip = (s: string, n = 160) => (s.length <= n ? s : `${s.slice(0, n - 1).replace(/\s+\S*$/, '')}…`);
const home: Crumb = { name: 'Home', url: '/' };
const hubCrumb: Crumb = { name: cap(S.plural), url: hubUrl };

export function regionPage(r: Region) {
  const n = r.listings.length;
  return {
    path: r.url,
    title: `${cap(S.plural)} in ${r.name}: ${n} listed by city | ${site.name}`,
    description: `${n} ${plural(n)} in ${r.name} across ${r.cities.length} ${r.cities.length === 1 ? 'city' : 'cities'}, with ${site.factsPhrase}. Updated ${monthYear(today())}.`,
    h1: `${cap(S.plural)} in ${r.name}`,
    noindex: !isIndexable(n),
    crumbs: [home, hubCrumb, { name: r.name, url: r.url }],
  };
}

export function cityPage(c: City, r: Region) {
  const n = c.listings.length;
  const where = `${c.name}, ${r.abbr}`;
  return {
    path: c.url,
    title: `${cap(S.plural)} in ${where} (${n} listed) | ${site.name}`,
    description: `${n} ${plural(n)} in ${where}: ${site.factsPhrase}. Free to use, updated ${monthYear(today())}.`,
    h1: `${cap(S.plural)} in ${where}`,
    noindex: !isIndexable(n),
    crumbs: [home, hubCrumb, { name: r.name, url: r.url }, { name: c.name, url: c.url }],
  };
}

export function listingPage(l: Entry, c: City, r: Region) {
  return {
    path: l.url,
    title: `${l.name}, ${S.singular} in ${c.name}, ${r.abbr} | ${site.name}`,
    description: clip(`${l.summary} ${S.singular[0].toUpperCase() + S.singular.slice(1)} in ${c.name}, ${r.abbr}.`),
    h1: l.name,
    noindex: l.status === 'closed',
    crumbs: [home, hubCrumb, { name: r.name, url: r.url }, { name: c.name, url: c.url }, { name: l.name, url: l.url }],
  };
}

export function facetPage(f: Facet, c: City, r: Region) {
  const n = f.listings.length;
  const where = `${c.name}, ${r.abbr}`;
  return {
    path: f.url,
    title: `${f.heading} (${n} listed) | ${site.name}`,
    description: clip(`${n} ${plural(n)} in ${where} listing ${f.label.toLowerCase()}. Compare ${site.factsPhrase}.`),
    h1: f.heading,
    intro: `${n} of the ${c.listings.length} ${plural(c.listings.length)} listed in ${where} list ${f.label.toLowerCase()}. Compare their ${site.factsPhrase} below.`,
    noindex: !isIndexable(n),
    crumbs: [home, hubCrumb, { name: r.name, url: r.url }, { name: c.name, url: c.url }, { name: f.label, url: f.url }],
  };
}

export function termPage(t: Term) {
  const def = attributeDefs[t.attr];
  const tax = def.type === 'multi' ? def.taxonomy! : undefined;
  const n = t.listings.length;
  return {
    path: t.url,
    title: `${tax!.heading(t.label)} (${n} listed) | ${site.name}`,
    description: clip(`${n} ${plural(n)} listing ${t.label}, by ${site.regionWord} and city. ${tax!.intro(t.label)}`),
    h1: tax!.heading(t.label),
    intro: tax!.intro(t.label),
    noindex: !isIndexable(n),
    crumbs: [home, { name: cap(tax!.segment.replace(/-/g, ' ')), url: `/${tax!.segment}/` }, { name: t.label, url: t.url }],
  };
}

export function hubPage(regions: Region[], total: number) {
  return {
    path: hubUrl,
    title: `${cap(S.plural)} by ${site.regionWord} (${total} listed) | ${site.name}`,
    description: `Browse ${total} ${plural(total)} by ${site.regionWord} and city. ${cap(site.factsPhrase)} for each listing.`,
    h1: `${cap(S.plural)} by ${site.regionWord}`,
    noindex: !isIndexable(total),
    crumbs: [home, hubCrumb],
    regions,
  };
}

export function taxonomies(terms: Term[]) {
  const out: { segment: string; title: string; attr: string; terms: Term[] }[] = [];
  for (const [attr, def] of Object.entries(attributeDefs)) {
    if (def.type !== 'multi' || !def.taxonomy) continue;
    const ts = terms.filter((t) => t.attr === attr);
    if (ts.length) out.push({ segment: def.taxonomy.segment, title: def.taxonomy.title, attr, terms: ts });
  }
  return out;
}

export async function allData() {
  return loadData();
}
