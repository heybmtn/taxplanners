import type { APIRoute, GetStaticPaths } from 'astro';
import { loadData, type City } from '../../../lib/data.ts';
import { json, publicListing } from '../../../lib/api.ts';
import { today } from '../../../lib/tier.ts';
export const getStaticPaths: GetStaticPaths = async () =>
  (await loadData()).regions.flatMap((r) => r.cities.map((c) => ({ params: { region: r.slug, city: c.slug }, props: { city: c } })));
export const GET: APIRoute = ({ props }) => {
  const c = props.city as City;
  return json({ generated: today(), region: c.region, city: c.slug, name: c.name, count: c.listings.length, listings: c.listings.map(publicListing) });
};
