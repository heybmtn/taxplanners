// Server-side search: filters and paginates the static /search/ page (which holds every listing card)
// with HTMLRewriter, using the same matching rules as src/lib/search.ts. No client JavaScript needed.
import site from '../site.config.ts';
import { activeFilters, isEmptyQuery, parseQuery, search, toParams, type Query, type SearchListing } from './lib/search.ts';

let listingsCache: Promise<SearchListing[]> | undefined;

function loadListings(assets: Fetcher, url: URL): Promise<SearchListing[]> {
  listingsCache ??= assets
    .fetch(new Request(new URL('/data/listings.json', url)))
    .then((r) => (r.ok ? (r.json() as Promise<{ listings: SearchListing[] }>) : { listings: [] }))
    .then((d) => d.listings)
    .catch(() => {
      listingsCache = undefined;
      return [];
    });
  return listingsCache;
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const titleCase = (s: string) => s.split('-').map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w)).join(' ');
const noun = (n: number) => (n === 1 ? site.entity.singular : site.entity.plural);

function paginationHtml(q: Query, page: number, pages: number): string {
  if (pages <= 1) return '';
  const link = (p: number, label: string, rel?: string) => `<li><a href="/search/${esc(toParams(q, { page: p }))}"${rel ? ` rel="${rel}"` : ''}>${label}</a></li>`;
  const items: string[] = [];
  if (page > 1) items.push(link(page - 1, '<span aria-hidden="true">←</span> Previous', 'prev'));
  for (let p = Math.max(1, page - 2); p <= Math.min(pages, page + 2); p++)
    items.push(p === page ? `<li><span aria-current="page">${p}</span></li>` : link(p, `<span class="visually-hidden">Page </span>${p}`));
  if (page < pages) items.push(link(page + 1, 'Next <span aria-hidden="true">→</span>', 'next'));
  return `<ul>${items.join('')}</ul>`;
}

export async function renderSearch(req: Request, assets: Fetcher, url: URL): Promise<Response> {
  const [page, listings] = await Promise.all([assets.fetch(req), loadListings(assets, url)]);
  if (!page.ok) return page;
  const q = parseQuery(url.searchParams);
  const r = search(listings, q);
  const keep = new Set(r.results.map((l) => `${l.region}/${l.city}/${l.slug}`));
  const stateNames = Object.fromEntries(listings.map((l) => [l.region, titleCase(l.region)]));
  const chips = activeFilters(q, stateNames);
  const checked = (name: string, value: string) =>
    name === 'verified' ? q.verified && value === '1'
    : name === 'meeting' ? q.meeting.includes(value)
    : name === 'languages' ? q.languages.some((l) => l.toLowerCase() === value.toLowerCase())
    : (q.attrs[name] ?? []).includes(value);

  const countText = r.total === 0 ? `No ${site.entity.plural} found` : `${r.total} ${noun(r.total)}${r.pages > 1 ? ` · page ${r.page} of ${r.pages}` : ''}`;
  const chipsHtml = chips.length
    ? chips.map((c) => `<li><a class="chip chip-remove" href="/search/${esc(toParams(q, { remove: c.remove }))}">${esc(c.label)} <span aria-hidden="true">×</span><span class="visually-hidden"> (remove filter)</span></a></li>`).join('') +
      '<li><a class="chip chip-remove" href="/search/">Clear all</a></li>'
    : '';

  const out = new HTMLRewriter()
    .on('title', { element: (el) => void el.setInnerContent(`${isEmptyQuery(q) ? 'Search' : 'Search results'}: ${countText} | ${site.name}`) })
    .on('li.result', { element: (el) => void (keep.has(el.getAttribute('data-id') ?? '') || el.remove()) })
    .on('#result-count', { element: (el) => void el.setInnerContent(countText) })
    .on('#no-results', { element: (el) => void (r.total === 0 && el.removeAttribute('hidden')) })
    .on('#results', { element: (el) => void (r.total === 0 && el.setAttribute('hidden', '')) })
    .on('#active-filters', { element: (el) => void (chipsHtml ? el.setInnerContent(chipsHtml, { html: true }) : el.remove()) })
    .on('#pagination', { element: (el) => void el.setInnerContent(paginationHtml(q, r.page, r.pages), { html: true }) })
    .on('#search-form input[name="location"]', { element: (el) => void (q.location && el.setAttribute('value', q.location)) })
    .on('#search-form input[type="checkbox"]', {
      element: (el) => {
        if (checked(el.getAttribute('name') ?? '', el.getAttribute('value') ?? '')) el.setAttribute('checked', '');
        else el.removeAttribute('checked');
      },
    })
    .on('#search-form option[data-state]', { element: (el) => void (el.getAttribute('value') === q.state && el.setAttribute('selected', '')) })
    .transform(page);

  const headers = new Headers(out.headers);
  headers.set('Cache-Control', 'public, max-age=300');
  headers.set('X-Robots-Tag', 'noindex, follow');
  return new Response(out.body, { status: 200, headers });
}
