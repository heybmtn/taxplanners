import type { APIRoute } from 'astro';
import { loadData } from '../../lib/data.ts';
import { json, publicListing } from '../../lib/api.ts';
import { today } from '../../lib/tier.ts';
export const GET: APIRoute = async () => {
  const { published } = await loadData();
  return json({ generated: today(), count: published.length, listings: published.map(publicListing) });
};
