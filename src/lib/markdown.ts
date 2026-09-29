// Markdown twins ({url}index.md), llms.txt and llms-full.txt.
import site from '../../site.config.ts';
import { loadData, nearby, hubUrl, type City, type Entry, type Region } from './data.ts';
import { cityPage, facetPage, hubPage, listingPage, regionPage, taxonomies, termPage } from './pages.ts';
import { abs } from './seo.ts';
import { addressLine, bestFor, factRows, formatDate, hasHours, hoursRows, listingFaqs, mapsUrl, plural } from './format.ts';
import { copy, formUrl, plansUrl, payLabel, paymentLink, tierName } from './copy.ts';
import { plans, howItWorks, comparison } from './plans.ts';

const esc = (s: string) => s.replace(/\|/g, '\\|');
const head = (title: string, path: string, desc?: string) => `# ${title}\n\nCanonical: ${abs(path)}\n${desc ? `\n${desc}\n` : ''}`;
const link = (name: string, path: string) => `[${esc(name)}](${abs(path)})`;
const faqMd = (faqs: readonly { q: string; a: string }[]) => (faqs.length ? `\n## Questions\n\n${faqs.map((f) => `### ${f.q}\n\n${f.a}\n`).join('\n')}` : '');
const disclosure = `${copy.disclosure} ${link(copy.disclosureLink, plansUrl)}`;

function table(list: Entry[], withCity = false) {
  const rows = list.map((l) => `| ${link(l.name, l.url)} | ${tierName[l.tierNow]} |${withCity ? ` ${esc(l.address.locality)} |` : ''} ${esc(l.phone ?? '')} | ${esc(l.website ?? '')} | ${formatDate(l.lastUpdated)} |`);
  return `| Name | Tier |${withCity ? ' City |' : ''} Phone | Website | Last updated |\n|---|---|${withCity ? '---|' : ''}---|---|---|\n${rows.join('\n')}\n`;
}

export function listingMd(l: Entry, c: City, r: Region, near: Entry[]) {
  const p = listingPage(l, c, r);
  const v = l.tierNow === 'verified';
  let md = head(l.name, p.path, l.summary);
  md += `\nTier: ${tierName[l.tierNow]}${v ? ` (${copy.verifiedNote}, until ${formatDate(l.verifiedUntil!)})` : ''}\n`;
  if (v && l.verification?.businessConfirmed) md += `\nBusiness details confirmed by the owner: ${l.verification.businessConfirmed}\n`;
  if (v && l.verification?.credentialsChecked) md += `\nCredentials checked: ${l.verification.credentialsChecked}${l.verification.credentialSource ? ` (${l.verification.credentialSource})` : ''}\n`;
  if (l.status === 'closed') md += '\nStatus: permanently closed\n';
  if (v && l.description) md += `\n${l.description}\n`;
  if (v && l.bookingUrl) md += `\nBooking: ${l.bookingUrl}\n`;
  md += `\n## Details\n\n| Fact | Value |\n|---|---|\n${factRows(l).map((f) => `| ${f.label} | ${esc(f.label === 'Website' ? (l.website ?? 'Not listed') : (f.value ?? 'Not listed'))} |`).join('\n')}\n`;
  if (l.sameAs.length) md += `\nAlso on: ${l.sameAs.join(', ')}\n`;
  md += `\nGoogle Maps: ${mapsUrl(l)}\n`;
  md += `\n## Hours\n\n${hasHours(l) ? hoursRows(l).map((h) => `- ${h.day}: ${h.text}`).join('\n') : 'Not listed.'}\n`;
  md += faqMd(listingFaqs(l));
  if (near.length) md += `\n## Nearby ${site.entity.plural}\n\n${near.map((n) => `- ${link(n.name, n.url)}, ${n.address.locality}`).join('\n')}\n`;
  md += `\nLast updated: ${l.lastUpdated}. Source: ${l.source}.\n`;
  md += `\n${v ? copy.verifiedCta : copy.basicCta}: ${abs(`${formUrl}?listing=${l.slug}`)}\n`;
  return md;
}

export function cityMd(c: City, r: Region) {
  const p = cityPage(c, r);
  let md = head(p.h1, p.path, p.description);
  md += `\n${disclosure}\n\n${table(c.listings)}`;
  const bf = bestFor(c.listings);
  if (bf.length) md += `\n## Best for\n\n${bf.map((g) => `- ${g.label}: ${g.listings.map((l) => l.name).join(', ')}`).join('\n')}\n`;
  const others = r.cities.filter((x) => x.slug !== c.slug);
  if (others.length) md += `\n## Other cities in ${r.name}\n\n${others.map((x) => `- ${link(x.name, x.url)} (${x.listings.length})`).join('\n')}\n`;
  return md;
}

export function regionMd(r: Region) {
  const p = regionPage(r);
  return `${head(p.h1, p.path, p.description)}\n## Cities\n\n${r.cities.map((c) => `- ${link(c.name, c.url)} (${c.listings.length})`).join('\n')}\n\n## All ${site.entity.plural}\n\n${disclosure}\n\n${table(r.listings, true)}`;
}

export async function allTwins(): Promise<{ path: string; body: string }[]> {
  const { all, regions, terms, published } = await loadData();
  const out: { path: string; body: string }[] = [];
  const hp = hubPage(regions, published.length);
  out.push({ path: hubUrl, body: `${head(hp.h1, hp.path, hp.description)}\n${regions.map((r) => `- ${link(r.name, r.url)} (${r.listings.length})`).join('\n')}\n` });
  for (const r of regions) {
    out.push({ path: r.url, body: regionMd(r) });
    for (const c of r.cities) {
      out.push({ path: c.url, body: cityMd(c, r) });
      for (const f of c.facets) {
        const p = facetPage(f, c, r);
        out.push({ path: f.url, body: `${head(p.h1, p.path, p.intro)}\n${disclosure}\n\n${table(f.listings)}` });
      }
    }
  }
  for (const l of all) {
    const r = regions.find((x) => x.slug === l.region);
    const c = r?.cities.find((x) => x.slug === l.city);
    if (r && c) out.push({ path: l.url, body: listingMd(l, c, r, nearby(l, published)) });
  }
  for (const t of taxonomies(terms)) {
    out.push({ path: `/${t.segment}/`, body: `${head(t.title, `/${t.segment}/`)}\n${t.terms.map((x) => `- ${link(x.label, x.url)} (${x.listings.length})`).join('\n')}\n` });
    for (const term of t.terms) {
      const p = termPage(term);
      out.push({ path: term.url, body: `${head(p.h1, p.path, p.intro)}\n${disclosure}\n\n${table(term.listings, true)}` });
    }
  }
  out.push({ path: '/', body: homeMd(regions) });
  out.push({ path: plansUrl, body: plansMd() });
  out.push({ path: '/about/', body: aboutMd() });
  out.push({ path: '/privacy/', body: `${head('Privacy', '/privacy/')}\nNo cookies, analytics or advertising scripts. Form submissions are emailed to us and not stored; submitter contact details are never published. The form uses Cloudflare Turnstile. Contact: ${site.submissionsEmail}\n` });
  out.push({ path: '/verification/', body: `${head('How verification works', '/verification/', site.verifiedMeaning)}\n${site.verifiedNotEndorsement}\n\n## The process\n\n${howItWorks.map((s, i) => `${i + 1}. **${s.title}.** ${s.text}`).join('\n')}\n\n${copy.basicDefinition}\n` });
  out.push({ path: '/contact/', body: `${head('Contact', '/contact/')}\nAdd or correct a listing: ${abs(formUrl)}. Everything else: ${site.submissionsEmail}.\n` });
  out.push({ path: '/terms/', body: `${head('Terms of use', '/terms/')}\nInformation, not advice: nothing on ${site.name} is tax, legal or financial advice or a recommendation. ${site.verifiedNotEndorsement} ${site.independence}\n` });
  out.push({ path: formUrl, body: `${head('Add or update a listing', formUrl)}\nSend a new listing or a correction with the form at ${abs(formUrl)}. Add ?listing={slug} to update an existing listing, or ?tier=verified to request Verified. Plans: ${abs(plansUrl)}\n` });
  return out;
}

function homeMd(regions: Region[]) {
  let md = head(`${site.name}: find ${site.entity.article} ${site.entity.singular} near you`, '/', site.description);
  md += `\n## Browse by ${site.regionWord}\n\n${regions.map((r) => `- ${link(r.name, r.url)} (${r.listings.length}): ${r.cities.map((c) => link(c.name, c.url)).join(', ')}`).join('\n') || 'No listings yet.'}\n`;
  md += `\n## How listings work\n\n${copy.basicDefinition}\n\n${copy.verifiedDefinition}\n\n${disclosure}\n`;
  md += faqMd([...site.homeFaqs, { q: 'How are listings ordered here?', a: `${copy.ordering} ${copy.disclosure}` }]);
  return md;
}

function plansMd() {
  let md = head(plans.h1, plansUrl, plans.intro);
  md += `\n## Compare\n\n| Feature | Basic | Verified |\n|---|---|---|\n${comparison.map((r) => `| ${r.feature} | ${r.basic ? 'Yes' : 'No'} | ${r.verified ? 'Yes' : 'No'} |`).join('\n')}\n`;
  md += `\n## Basic: Free\n\n${plans.basic.map((b) => `- ${b}`).join('\n')}\n\n## Verified: ${site.verifiedPrice}\n\n${plans.verified.map((b) => `- ${b}`).join('\n')}\n`;
  md += `\n## How to get a Verified listing\n\n${plans.steps.map((s, i) => `${i + 1}. ${s}`).join('\n')}\n\n- ${plans.sendLabel}: ${abs(plans.sendUrl)}\n- ${payLabel}: ${paymentLink()}\n`;
  return md + faqMd(plans.faqs);
}

function aboutMd() {
  return `${head(`About ${site.name}`, '/about/', site.operator)}\n## How listings are sourced\n\nPublic sources (the business's own website and public registers) or submissions through the form. Each listing shows its last-updated date and source. No ratings or reviews.\n\n## Basic and Verified listings\n\n${copy.basicDefinition}\n\n${copy.verifiedDefinition}\n\nBefore we mark a listing Verified, ${site.credentialCheck}, and we confirm with the owner that they run the business and that the details are right. ${copy.ordering}\n`;
}

export async function llmsTxt() {
  const { regions, published } = await loadData();
  return `# ${site.name}

> ${site.description}

${site.operator} ${site.independence}

${site.verifiedMeaning} ${site.verifiedNotEndorsement}

## Data and sourcing
- Listings come from public sources (business websites, public registers) or owner/public submissions. Each listing has a lastUpdated date and a source. No ratings, reviews or referral fees.
- ${copy.basicDefinition}
- ${copy.verifiedDefinition}
- Order on list pages: ${copy.ordering}
- Every page has a markdown twin at {page URL}index.md.

## Location indexes
- [All ${site.entity.plural} by ${site.regionWord}](${abs(`${hubUrl}index.md`)})
${regions.map((r) => `- [${r.name}](${abs(`${r.url}index.md`)}): ${r.cities.map((c) => `[${c.name}](${abs(`${c.url}index.md`)})`).join(', ')}`).join('\n')}

## Data files
- [All listings (JSON)](${abs('/data/listings.json')}): ${published.length} ${plural(published.length)}
${regions.flatMap((r) => r.cities.map((c) => `- [${c.name}, ${r.abbr} (JSON)](${abs(`/data/${r.slug}/${c.slug}.json`)})`)).join('\n')}
- [Field reference](${abs('/data/README.md')})
- [Every listing in one file](${abs('/llms-full.txt')})

## Search
- Search results page (HTML): ${abs('/search/')}?location={city-state-or-zip}&credentials={key}&services={key}&clients={key}&meeting={virtual|inPerson}&languages={name}&verified=1 (parameters are optional; option keys are in /data/README.md)

## Pages
- [How verification works](${abs('/verification/index.md')})
- [Listing plans](${abs(`${plansUrl}index.md`)})
- [About and sources](${abs('/about/index.md')})
- [Add or update a listing](${abs(formUrl)})
`;
}

export async function llmsFullTxt() {
  const { regions } = await loadData();
  let out = `# ${site.name}: all published ${site.entity.plural}\n\n${copy.disclosure} Tier is shown for each listing.\n`;
  for (const r of regions) {
    out += `\n## ${r.name}\n`;
    for (const c of r.cities) {
      out += `\n### ${c.name}, ${r.abbr}\n`;
      for (const l of c.listings) {
        out += `\n#### ${l.name}\n\n- URL: ${abs(l.url)}\n- Tier: ${tierName[l.tierNow]}\n- Address: ${addressLine(l)}\n`;
        for (const f of factRows(l).slice(1)) if (f.value) out += `- ${f.label}: ${f.label === 'Website' ? l.website : f.value}\n`;
        out += `- Summary: ${l.summary}\n- Last updated: ${l.lastUpdated}\n`;
      }
    }
  }
  return out;
}

