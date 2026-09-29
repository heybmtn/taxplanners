import { test } from 'node:test';
import assert from 'node:assert/strict';
import { effectiveTier, sortListings } from '../src/lib/tier.ts';

test('an expired verifiedUntil counts as Basic', () => {
  assert.equal(effectiveTier({ tier: 'verified', verifiedUntil: '2026-09-28' }, '2026-09-29'), 'basic');
  assert.equal(effectiveTier({ tier: 'verified', verifiedUntil: '2026-09-29' }, '2026-09-29'), 'verified');
  assert.equal(effectiveTier({ tier: 'verified', verifiedUntil: null }, '2026-09-29'), 'basic');
  assert.equal(effectiveTier({ tier: 'basic', verifiedUntil: '2030-01-01' }, '2026-09-29'), 'basic');
});

test('ordering: Verified first, then completeness, then A–Z', () => {
  const base = { status: 'published', address: { locality: 'X', region: 'TX', country: 'US' }, sameAs: [], hours: {}, attributes: {}, summary: 's', lastUpdated: '2026-01-01', source: 's' } as any;
  const list = [
    { ...base, name: 'B', slug: 'b', tier: 'basic' },
    { ...base, name: 'A', slug: 'a', tier: 'basic' },
    { ...base, name: 'Z', slug: 'z', tier: 'basic', phone: '1' },
    { ...base, name: 'Y', slug: 'y', tier: 'verified', verifiedUntil: '2020-01-01', phone: '1', website: 'https://y.com' },
    { ...base, name: 'V', slug: 'v', tier: 'verified', verifiedUntil: '2030-01-01' },
  ];
  assert.deepEqual(sortListings(list, '2026-09-29').map((l) => l.name), ['V', 'Y', 'Z', 'A', 'B']);
});
