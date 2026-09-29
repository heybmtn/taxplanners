import type { APIRoute } from 'astro';
import site from '../../../site.config.ts';
import { copy } from '../../lib/copy.ts';
import { attributeDefs } from '../../lib/schema.ts';

const attrs = Object.entries(attributeDefs)
  .map(([k, d]) => `  - \`${k}\` (${d.type === 'multi' ? `one or more of: ${Object.keys(d.options).join(', ')}` : d.type === 'bool' ? 'true/false' : 'list of strings'}): ${d.label}`)
  .join('\n');

const body = `# ${site.name} data files

Read-only. Regenerated on every build (at least daily). \`/data/listings.json\` holds every published listing; \`/data/{region}/{city}.json\` holds one city. Lists are ordered: ${copy.ordering}

## Fields
- \`name\`, \`slug\`, \`status\` (published | closed), \`region\`, \`city\` (folder slugs), \`url\` (canonical page)
- \`tier\`: \`basic\` or \`verified\`, as shown on the site today (an expired Verified listing is \`basic\`). ${copy.verifiedDefinition}
- \`verifiedUntil\`: date the Verified period ends (null for Basic)
- \`address\` { street, locality, region, postalCode, country }, \`lat\`, \`lng\`, \`phone\`, \`website\`, \`sameAs\` (links)
- \`hours\`: per weekday, a list of { opens, closes } in 24h time; \`null\` = closed; missing day = not listed
- \`summary\`: 1–2 factual sentences
- \`attributes\`:
${attrs}
- \`description\`, \`bookingUrl\`: owner-supplied, Verified listings only
- \`lastUpdated\`: date the details were last checked or changed
- \`source\`: where the details came from
`;
export const GET: APIRoute = () => new Response(body, { headers: { 'Content-Type': 'text/markdown; charset=utf-8' } });
