// JSON-LD builders. Nothing here claims verification, ratings or reviews.
import site from '../../site.config.ts';
import { weekdays, type Listing } from './schema.ts';
import type { Entry } from './data.ts';

export const abs = (path: string) => new URL(path, site.url).toString();

export type Crumb = { name: string; url: string };

export function breadcrumbLd(crumbs: Crumb[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.name, item: abs(c.url) })),
  };
}

export function itemListLd(name: string, list: Entry[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name,
    numberOfItems: list.length,
    itemListElement: list.map((l, i) => ({ '@type': 'ListItem', position: i + 1, url: abs(l.url), name: l.name })),
  };
}

export function faqLd(faqs: { q: string; a: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
  };
}

export function homeLd() {
  return [
    { '@context': 'https://schema.org', '@type': 'Organization', name: site.name, url: site.url },
    { '@context': 'https://schema.org', '@type': 'WebSite', name: site.name, url: site.url, description: site.description, inLanguage: site.lang },
  ];
}

export function listingLd(l: Entry & Listing, includeOwnerFields: boolean) {
  const days = weekdays.filter((d) => l.hours[d]?.length);
  const ld: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': site.schemaType,
    '@id': abs(l.url),
    name: l.name,
    url: l.website ?? abs(l.url),
    description: l.summary,
    address: {
      '@type': 'PostalAddress',
      ...(l.address.street && { streetAddress: l.address.street }),
      addressLocality: l.address.locality,
      addressRegion: l.address.region,
      ...(l.address.postalCode && { postalCode: l.address.postalCode }),
      addressCountry: l.address.country,
    },
    dateModified: l.lastUpdated,
  };
  if (l.lat != null && l.lng != null) ld.geo = { '@type': 'GeoCoordinates', latitude: l.lat, longitude: l.lng };
  if (l.phone) ld.telephone = l.phone;
  const same = [...l.sameAs, ...(l.website ? [l.website] : [])];
  if (same.length) ld.sameAs = same;
  if (days.length)
    ld.openingHoursSpecification = days.flatMap((d) =>
      l.hours[d]!.map((s) => ({ '@type': 'OpeningHoursSpecification', dayOfWeek: `https://schema.org/${d[0].toUpperCase()}${d.slice(1)}`, opens: s.opens, closes: s.closes })),
    );
  if (includeOwnerFields && l.bookingUrl) ld.potentialAction = { '@type': 'ReserveAction', target: l.bookingUrl };
  return ld;
}
