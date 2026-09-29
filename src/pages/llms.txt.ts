import type { APIRoute } from 'astro';
import { llmsTxt } from '../lib/markdown.ts';
export const GET: APIRoute = async () => new Response(await llmsTxt(), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
