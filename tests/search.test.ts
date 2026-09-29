import { test } from 'node:test';
import assert from 'node:assert/strict';
import { activeFilters, matchesLocation, parseQuery, search, toParams, type SearchListing } from '../src/lib/search.ts';

const L = (over: Partial<SearchListing> & { slug: string }): SearchListing => ({
  region: 'texas', city: 'austin', name: over.slug, tier: 'basic',
  address: { locality: 'Austin', region: 'TX', postalCode: '78701' }, attributes: {}, ...over,
});
const data = [
  L({ slug: 'a', tier: 'verified', attributes: { credentials: ['cpa'], services: ['tax-planning'], virtual: true, languages: ['English', 'Spanish'] } }),
  L({ slug: 'b', attributes: { credentials: ['enrolled-agent'], clients: ['small-business'], inPerson: true } }),
  L({ slug: 'c', region: 'new-york', city: 'new-york', address: { locality: 'New York', region: 'NY', postalCode: '10001' }, attributes: { credentials: ['cpa', 'tax-attorney'] } }),
];
const q = (s: string) => parseQuery(new URLSearchParams(s));
const ids = (s: string) => search(data, q(s)).results.map((l) => l.slug);

test('location: city, state, abbreviation, ZIP and prefixes', () => {
  assert.deepEqual(ids('location=Austin'), ['a', 'b']);
  assert.deepEqual(ids('location=Austin, TX'), ['a', 'b']);
  assert.deepEqual(ids('location=texas'), ['a', 'b']);
  assert.deepEqual(ids('location=new york ny'), ['c']);
  assert.deepEqual(ids('location=10001'), ['c']);
  assert.deepEqual(ids('location=aus'), ['a', 'b']);
  assert.deepEqual(ids('location=Dallas'), []);
  assert.equal(matchesLocation(data[0], '787'), false, 'partial ZIPs do not match');
});

test('filters: OR within an attribute, AND across attributes', () => {
  assert.deepEqual(ids('credentials=cpa'), ['a', 'c']);
  assert.deepEqual(ids('credentials=cpa&credentials=enrolled-agent'), ['a', 'b', 'c']);
  assert.deepEqual(ids('credentials=cpa&services=tax-planning'), ['a']);
  assert.deepEqual(ids('need=clients:small-business'), ['b']);
  assert.deepEqual(ids('meeting=virtual'), ['a']);
  assert.deepEqual(ids('meeting=inPerson&meeting=virtual'), ['a', 'b']);
  assert.deepEqual(ids('languages=spanish'), ['a']);
  assert.deepEqual(ids('verified=1'), ['a']);
  assert.deepEqual(ids('state=new-york'), ['c']);
  assert.deepEqual(ids('credentials=cpa&location=Austin&verified=1'), ['a']);
});

test('unknown values are ignored, not trusted', () => {
  const x = q('credentials=<script>&need=evil:x&meeting=hack&page=-4');
  assert.deepEqual(x.attrs, {});
  assert.deepEqual(x.meeting, []);
  assert.equal(x.page, 1);
  assert.equal(q('location=Austin"><script>alert(1)</script>').location, 'Austinscriptalert1script');
  assert.equal(q("location=St. John's, NL").location, "St. John's, NL");
});

test('pagination and filter chips', () => {
  const many = Array.from({ length: 45 }, (_, i) => L({ slug: `x${i}` }));
  const r = search(many, q('page=3'));
  assert.equal(r.total, 45);
  assert.equal(r.pages, 3);
  assert.equal(r.results.length, 5);
  assert.equal(search(many, q('page=99')).page, 3);
  const query = q('location=Austin&credentials=cpa&verified=1');
  const chips = activeFilters(query);
  assert.deepEqual(chips.map((c) => c.label), ['Near "Austin"', 'CPA', 'Verified only']);
  assert.equal(toParams(query, { remove: ['credentials', 'cpa'] }), '?location=Austin&verified=1');
  assert.equal(toParams(query, { page: 2 }), '?location=Austin&credentials=cpa&verified=1&page=2');
});
