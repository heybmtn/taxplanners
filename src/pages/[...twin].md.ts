import type { APIRoute, GetStaticPaths } from 'astro';
import { allTwins } from '../lib/markdown.ts';

export const getStaticPaths: GetStaticPaths = async () =>
  (await allTwins()).map((t) => ({ params: { twin: `${t.path.slice(1)}index` }, props: { body: t.body } }));

export const GET: APIRoute = ({ props }) => new Response(props.body, { headers: { 'Content-Type': 'text/markdown; charset=utf-8' } });
