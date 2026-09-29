# Updating listings (for AI agents)

Listings are JSON files: `src/content/listings/{region}/{city}/{slug}.json` (region = full state name slug, e.g. `texas`; city slug, e.g. `round-rock`; `slug` field = file name). The schema is `src/lib/schema.ts`; attribute keys and allowed values are in `site.config.ts`. Never invent businesses, hours, prices, reviews or ratings.

## Add
Copy an existing file, fill in the facts you have (unknown = `null` or omit), set `status: "published"`, `tier: "basic"`, `lastUpdated` to today, `source` to where the facts came from, and a 1–2 sentence third-person factual `summary`. Many rows: `npm run import:csv -- file.csv --source "..."` (dedupes on name + postcode + phone).

## Edit
Change only the facts that changed and set `lastUpdated` to today. Moving city = move the file to the new folder.

## Close or remove
Closed permanently: set `status: "closed"` (page stays, marked closed, dropped from lists). Remove entirely: delete the file. Demo data: `npm run demo:remove`.

## Handling a submission email
1. The email has a JSON block shaped like a listing file. Search for an existing listing by name + postcode + phone (`grep -ril "name" src/content/listings`).
2. Existing: merge the new facts into that file. New: create the file at the suggested path (fix the region folder to the full state slug).
3. Write the `summary` yourself (factual, third person). Never copy submitter name, email or relationship into the public file.
4. Keep `tier: "basic"` even if the email says "Tier requested: Verified", until the site owner confirms payment and ownership.

## Upgrading to Verified (only when the site owner confirms payment AND ownership)
Set `"tier": "verified"`, `"verifiedUntil"` to one year from today (unless told otherwise), add the owner's `description` (max ~150 words) and `bookingUrl` if given, set `lastUpdated` to today.

## Downgrading
Set `"tier": "basic"` and remove `verifiedUntil`, `description` and `bookingUrl`. (An expired `verifiedUntil` already renders as Basic after the daily rebuild.)

## Check and publish
```sh
npm run check      # types, content schema, unit tests, contrast
npm run build      # fails on a bad listing file
git add -A && git commit -m "Listings: <what changed>" && git push origin main
```
Pushing to `main` deploys the site.
