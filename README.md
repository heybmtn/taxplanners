# TaxPlanners.com

A static, agent-first directory of tax planners in the US. Astro (static output, zero client JS except Turnstile on the form), hosted on Cloudflare Workers static assets, with one small Worker for the "Add your business" form.

## Develop

```sh
npm install
npm run dev            # http://localhost:4321, includes the demo listings
npm run check          # astro check (types + content schema), unit tests, colour contrast
npm run build          # production build into dist/ (demo listings excluded) + output checks
npm run build:preview  # same, with demo listings
npm run lighthouse     # preview build + Lighthouse (mobile) on home, a city and a listing page; fails below 100
npm run worker:dev     # preview build served by wrangler dev, with the form Worker
```

Node 22.18+ (TypeScript scripts and tests run with Node's built-in type stripping).

## Layout

- `site.config.ts`: every niche and domain setting (entity noun, URL hub, attributes, FAQs, credential check wording, price, contacts).
- `src/theme.css`: colours, font, spacing, radius (CSS custom properties). `node scripts/contrast.mjs` checks the pairs listed in its header comment.
- `docs/BRIEF.md`: keyword research, templates and design decisions.
- `src/content/listings/{region}/{city}/{slug}.json`: one file per listing, validated by `src/lib/schema.ts`. `src/content/places/` holds optional region/city intros.
- `src/pages/`: HTML routes; `[...twin].md.ts` builds a markdown twin for every page; `llms.txt`, `llms-full.txt`, `data/*.json` and `robots.txt` are endpoints.
- `src/worker.ts` + `src/form/handler.ts`: the form Worker (Turnstile, zod validation, `send_email`).
- `UPDATING.md`: how an AI agent edits listings and handles submission emails.

## Deploy

`.github/workflows/deploy.yml` runs `check`, `build` and `wrangler deploy` on every push to `main` and daily at 05:17 UTC (so expired Verified listings drop to Basic). It needs repository secrets `CLOUDFLARE_API_TOKEN` (Workers edit permission) and `CLOUDFLARE_ACCOUNT_ID`, and a repository variable `TURNSTILE_SITE_KEY`. Alternatively connect the repo in Workers Builds with build command `npm run build` and deploy command `npx wrangler deploy`, plus a daily deploy hook.

One-off manual deploy: `npx wrangler login && npm run deploy`.

Cloudflare dashboard steps:
1. **Custom domain:** Workers & Pages → taxplanners → Settings → Domains & Routes → add `taxplanners.com` (and `www` redirect).
2. **Email Routing:** enable on the zone, add and verify the destination address set in `wrangler.jsonc` (`send_email.destination_address`, same as `submissionsEmail`). The sender (`senderEmail`) must be on the zone.
3. **Turnstile:** create a widget for the domain; put the site key in `site.config.ts` (`turnstileSiteKey`) or the `TURNSTILE_SITE_KEY` variable, and `npx wrangler secret put TURNSTILE_SECRET`. Without the secret, every submission fails closed to the error page.
4. **Payment link:** set `verifiedPaymentLink` (e.g. a Stripe Payment Link, success URL `https://taxplanners.com/add-your-business/thanks-verified/`) and, for Stripe, `paymentReferenceParam: 'client_reference_id'`.
5. **AI crawlers:** in AI Crawl Control, make sure the bots allowed in `robots.txt` are not blocked. Optionally enable Markdown for Agents.

## Start the next domain from this repo

1. Copy the repo. Change `site.config.ts` (domain, names, entity noun, hub, attributes, FAQs, credential check, price, contacts, schema type).
2. Change `src/theme.css` (palette, font, feel) and run `node scripts/contrast.mjs`.
3. Rewrite `docs/BRIEF.md` from fresh keyword research.
4. Replace the listing files (`npm run demo:remove`, then `npm run import:csv -- file.csv`), update `wrangler.jsonc` (`name`, email destination).
5. `npm run check && npm run build && npm run lighthouse`.

Engine code in `src/` holds no niche words; everything niche-specific comes from the files above.
