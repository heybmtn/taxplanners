// Loads listings once and derives regions, cities and taxonomy terms from the folder layout.
import { getCollection } from 'astro:content';
import site from '../../site.config.ts';
import type { Listing } from './schema.ts';
import { attributeDefs } from './schema.ts';
import { effectiveTier, sortListings, type Tier } from './tier.ts';

export type Entry = Listing & { region: string; city: string; url: string; tierNow: Tier };
export type Facet = { attr: string; key: string; label: string; heading: string; url: string; listings: Entry[] };
export type City = { slug: string; name: string; region: string; regionName: string; abbr: string; url: string; listings: Entry[]; intro?: string; facets: Facet[] };
export type Region = { slug: string; name: string; abbr: string; url: string; cities: City[]; listings: Entry[]; intro?: string };
export type Term = { attr: string; key: string; label: string; url: string; listings: Entry[] };

export const MIN_INDEXABLE = 3;
const includeDemo = process.env.INCLUDE_DEMO === '1';

export const hubUrl = `/${site.hub}/`;
const titleCase = (s: string) => s.split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');

let cache: Promise<{ all: Entry[]; published: Entry[]; regions: Region[]; terms: Term[]; languages: string[] }> | undefined;

export function loadData() {
  return (cache ??= build());
}

async function build() {
  const raw = await getCollection('listings');
  const places = new Map((await getCollection('places')).map((p) => [p.id, p]));
  const all: Entry[] = [];
  for (const e of raw) {
    const parts = e.id.split('/');
    if (parts.length !== 3) throw new Error(`Listing ${e.id}: expected listings/{region}/{city}/{slug}.json`);
    const [region, city, file] = parts;
    if (file !== e.data.slug) throw new Error(`Listing ${e.id}: slug "${e.data.slug}" must match the file name`);
    if (e.data.demo && !includeDemo) continue;
    all.push({ ...e.data, region, city, url: `/${site.hub}/${region}/${city}/${e.data.slug}/`, tierNow: effectiveTier(e.data) });
  }
  const published = sortListings(all.filter((l) => l.status === 'published'));

  const regionMap = new Map<string, Region>();
  for (const l of published) {
    let r = regionMap.get(l.region);
    if (!r) {
      const p = places.get(`${l.region}/index`);
      r = { slug: l.region, name: p?.data.name ?? titleCase(l.region), abbr: l.address.region, url: `/${site.hub}/${l.region}/`, cities: [], listings: [], intro: p?.body?.trim() };
      regionMap.set(l.region, r);
    }
    r.listings.push(l);
    let c = r.cities.find((x) => x.slug === l.city);
    if (!c) {
      const p = places.get(`${l.region}/${l.city}`);
      c = { slug: l.city, name: p?.data.name ?? l.address.locality, region: l.region, regionName: r.name, abbr: r.abbr, url: `${r.url}${l.city}/`, listings: [], intro: p?.body?.trim(), facets: [] };
      r.cities.push(c);
    }
    c.listings.push(l);
  }
  const regions = [...regionMap.values()].sort((a, b) => a.name.localeCompare(b.name));
  for (const r of regions) r.cities.sort((a, b) => a.name.localeCompare(b.name));

  // City landing pages per attribute option (e.g. /tax-planners/texas/austin/small-business/), only with 3+ listings.
  const facetKeys = new Set<string>();
  for (const def of Object.values(attributeDefs)) {
    if (def.type !== 'multi' || !def.cityFacet) continue;
    for (const key of Object.keys(def.options)) {
      if (facetKeys.has(key)) throw new Error(`Option "${key}" is used by two attributes; city facet URLs must be unique`);
      facetKeys.add(key);
    }
  }
  for (const r of regions)
    for (const c of r.cities) {
      for (const l of c.listings) if (facetKeys.has(l.slug)) throw new Error(`Listing slug "${l.slug}" clashes with a city facet URL; rename the file`);
      for (const [attr, def] of Object.entries(attributeDefs)) {
        if (def.type !== 'multi' || !def.cityFacet) continue;
        for (const [key, label] of Object.entries(def.options)) {
          const listings = c.listings.filter((l) => (l.attributes[attr] as string[] | undefined)?.includes(key));
          if (listings.length >= MIN_INDEXABLE) c.facets.push({ attr, key, label, heading: def.cityFacet(label, `${c.name}, ${r.abbr}`), url: `${c.url}${key}/`, listings });
        }
      }
    }

  const languages = [...new Set(published.flatMap((l) => (l.attributes.languages as string[] | undefined) ?? []))].sort();

  const terms: Term[] = [];
  for (const [attr, def] of Object.entries(attributeDefs)) {
    if (def.type !== 'multi' || !def.taxonomy) continue;
    for (const [key, label] of Object.entries(def.options)) {
      const listings = published.filter((l) => (l.attributes[attr] as string[] | undefined)?.includes(key));
      if (listings.length >= MIN_INDEXABLE) terms.push({ attr, key, label, url: `/${def.taxonomy.segment}/${key}/`, listings });
    }
  }
  return { all, published, regions, terms, languages };
}

/** Other listings in the same city first, then the same region. */
export function nearby(l: Entry, published: Entry[], n = 4): Entry[] {
  const others = published.filter((x) => x.slug !== l.slug || x.city !== l.city);
  return [...others.filter((x) => x.city === l.city && x.region === l.region), ...others.filter((x) => x.region === l.region && x.city !== l.city)].slice(0, n);
}

export function isIndexable(count: number) {
  return count >= MIN_INDEXABLE;
}
