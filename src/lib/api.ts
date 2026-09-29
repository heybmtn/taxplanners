// Public read-only JSON shape: the listing file plus derived fields. Owner-only fields appear only while Verified.
import type { Entry } from './data.ts';
import { abs } from './seo.ts';

export function publicListing(l: Entry) {
  const { demo, description, bookingUrl, verification, tierNow, url, ...rest } = l;
  const verified = tierNow === 'verified';
  return {
    ...rest,
    tier: tierNow,
    verifiedUntil: verified ? l.verifiedUntil : null,
    description: verified ? (description ?? null) : null,
    bookingUrl: verified ? (bookingUrl ?? null) : null,
    verification: verified ? (verification ?? null) : null,
    url: abs(url),
  };
}
export const json = (data: unknown) => new Response(JSON.stringify(data, null, 1), { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
