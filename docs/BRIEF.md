# Brief: TaxPlanners.com

**Niche:** local tax planners (CPAs, enrolled agents, tax attorneys and credentialed preparers who offer year-round tax planning). **Country:** United States (.com, IRS credentials, US states). **Audience:** households, self-employed people, small-business owners and property investors choosing a tax professional near them, plus AI agents answering "find me a tax planner in {city}".

## Research (September 2026, web search; no search volumes were available, so none are claimed)

- **What people call it.** "Tax planner", "tax preparer", "CPA", "tax advisor", "tax strategist" and "enrolled agent" are used side by side. Articles contrast them: preparers file returns; planners work year-round on strategy; CPAs are state-licensed; enrolled agents are IRS-licensed ([Kiplinger](https://www.kiplinger.com/personal-finance/cpa-vs-tax-planner-whats-the-difference), [SmartAsset](https://smartasset.com/taxes/tax-preparer-vs-cpa)). Yelp has separate result pages for "Tax Planning", "Tax Advisor", "Enrolled Agent" and "CPA Firms" ([Yelp Austin](https://www.yelp.com/search?find_desc=tax+planning&find_loc=Austin%2C+TX), [Yelp Boise](https://www.yelp.com/search?find_desc=Enrolled+Agent&find_loc=Boise%2C+ID)). → **Entity noun "tax planner"** (matches the domain), hub `/tax-planners/`.
- **Location.** Searches are "{service} in {city}, {ST}" and "near me"; results are city-level with a state. → `/tax-planners/{state}/{city}/{slug}/`; the state page is the region level.
- **Qualifiers.** Credential (CPA, EA, attorney, IRS AFSP), service (planning vs preparation, IRS representation, business tax, estate and trust), who they serve (self-employed, small business, real estate investors, high income), virtual meetings, free consultation. Cost is a big question: planning is sold as a flat-fee engagement or hourly ([Bench](https://www.bench.co/blog/tax-tips/tax-advisor-cost), [Yahoo Finance](https://finance.yahoo.com/news/tax-planning-services-really-theyll-140031436.html)). We publish no prices.
- **Common questions.** "Tax planner vs tax preparer vs CPA", "How much does tax planning cost / is it worth it", "How do I check a preparer's credentials" (IRS's own guidance: [Choosing a tax professional](https://www.irs.gov/tax-professionals/choosing-a-tax-professional)).
- **Who ranks now.** Austin (large): Yelp, Thumbtack, then single-firm pages. Boise (mid): Yelp, Expertise.com "best of" lists, CLA and local CPA sites. Bozeman (small): franchise office pages (H&R Block/Block Advisors, Jackson Hewitt) and local CPA sites. **Gaps:** none of them show the credential per firm in a comparable way, whether the firm does *planning* vs only returns, or virtual availability; listicles rank by review count or paid placement without saying so.
- **Public register.** The IRS [Directory of Federal Tax Return Preparers with Credentials and Select Qualifications](https://irs.treasury.gov/rpo/rpo.jsf) lists CPAs, EAs, attorneys and AFSP participants with active PTINs. CPA licences are also on state boards (CPAverify). NAEA runs a member directory ([taxexperts.naea.org](https://taxexperts.naea.org/)). → **Credential check for Verified:** "we check each named professional's credential in the IRS Directory of Federal Tax Return Preparers (or the state board of accountancy for CPAs)".
- **schema.org type:** `AccountingService` (LocalBusiness > FinancialService > AccountingService).

## Keyword clusters → page types

| Cluster | Example | Page |
|---|---|---|
| tax planner + city | tax planner Austin TX | `/tax-planners/texas/austin/` |
| tax planner + state | tax planners in Texas | `/tax-planners/texas/` |
| firm name | "Demo Tax Planner 1" | listing page |
| credential near me | enrolled agent near me, CPA near me | `/credentials/{enrolled-agent|cpa|…}/` (3+ listings only) |
| questions | tax planner vs CPA, check credentials | home FAQ, listing FAQs |

## Attributes (listing schema) and card facts

- `credentials[]`: cpa, enrolled-agent, tax-attorney, afsp, cfp
- `services[]`: tax-planning, tax-preparation, irs-representation, business-tax, estate-trust, bookkeeping-payroll
- `clients[]`: individuals, self-employed, small-business, real-estate-investors, high-income, expats
- `virtual` (bool), `inPerson` (bool), `freeConsultation` (bool), `yearRound` (bool), `wheelchairAccessible` (bool), `languages[]`
- **Card facts (max 5):** credentials, key services, virtual meetings, free consultation, city.

## Templates

- Title, city: `Tax planners in {City}, {ST} ({n} listed) | TaxPlanners.com`; meta: `{n} tax planners in {City}, {ST}: credentials (CPA, EA), services, virtual meetings and hours. Free to use, updated {Month YYYY}.`
- Title, state: `Tax planners in {State}: {n} listed by city | TaxPlanners.com`
- Title, listing: `{Name}, tax planner in {City}, {ST} | TaxPlanners.com`; meta: summary sentence + credentials.
- Title, credential: `{Credential} tax planners ({n} listed) | TaxPlanners.com`

## FAQs (home)

What does a tax planner do? · Tax planner, tax preparer or CPA: what's the difference? · How much does tax planning cost? · How do I check a tax planner's credentials? · How are listings ordered here?

## Design direction

- **Layout: location-led.** Searchers already know their city; they compare credentials. Home order: for-sale banner → header → H1 + one-line promise → "Browse by state" list → "Browse by credential" tiles (only terms with pages) → "How listings work" (Basic/Verified disclosure) → FAQ → footer.
- **Palette:** ink `#1b2a3a` on paper `#fbfaf6`; accent ledger green `#0d6149` (links, Verified border/badge); muted `#4a5663`; rule `#d9d6cc`. Banner: paper text on ink. All pairs ≥ 4.5:1 (checked with `scripts/contrast.mjs`).
- **Font:** system UI stack (no font file to download; fastest; no layout shift). Body 18px / 1.6, measure 70ch.
- **Feel:** calm, ledger-like; dense lists, 4px radius, 1px rules instead of shadows; one accent: a 4px green left border on Verified items.

## Defaults chosen (change in `site.config.ts`)

- For-sale contact, submissions inbox and payment: `hello@taxplanners.com` placeholders, payment is a `mailto:` (so the button reads "Email us to pay"). Verified price: **$99/year** placeholder.
- No listings CSV given → 3 demo listings (`demo: true`, Austin, TX), excluded from production builds, removed with `npm run demo:remove`.
- Taxonomy pages: credentials only (research shows "CPA/enrolled agent near me" searches), and only when a term has 3+ listings.
- The listing-form query parameters (`?listing=`, `?tier=verified`) are applied by the Worker with HTMLRewriter, so the form page needs no client JS besides Turnstile.
