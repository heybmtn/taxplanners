// Tier logic: a listing counts as Verified only while verifiedUntil is today or later.
import type { Listing } from './schema.ts';

export type Tier = 'basic' | 'verified';

/** Build date as YYYY-MM-DD (UTC). Override with BUILD_DATE for tests. */
export function today(): string {
  return process.env.BUILD_DATE ?? new Date().toISOString().slice(0, 10);
}

export function effectiveTier(l: Pick<Listing, 'tier' | 'verifiedUntil'>, on: string = today()): Tier {
  return l.tier === 'verified' && !!l.verifiedUntil && l.verifiedUntil >= on ? 'verified' : 'basic';
}

/** Count of filled optional facts, used to order listings within a tier. */
export function completeness(l: Listing): number {
  let n = 0;
  for (const v of [l.address.street, l.address.postalCode, l.phone, l.website, l.lat]) if (v != null && v !== '') n++;
  n += Object.keys(l.hours).length ? 2 : 0;
  n += l.sameAs.length ? 1 : 0;
  for (const v of Object.values(l.attributes)) if (v !== undefined && !(Array.isArray(v) && !v.length)) n++;
  return n;
}

/** Verified first, then Basic; within each, most complete first, then A–Z. */
export function sortListings<T extends Listing>(list: T[], on: string = today()): T[] {
  return [...list].sort(
    (a, b) =>
      Number(effectiveTier(b, on) === 'verified') - Number(effectiveTier(a, on) === 'verified') ||
      completeness(b) - completeness(a) ||
      a.name.localeCompare(b.name),
  );
}
