// Presentation helpers shared by HTML pages, markdown twins and data files.
import site from '../../site.config.ts';
import { attributeDefs, weekdays, type Listing, type Weekday } from './schema.ts';
import type { Entry } from './data.ts';

export const dayNames: Record<Weekday, string> = {
  monday: 'Monday', tuesday: 'Tuesday', wednesday: 'Wednesday', thursday: 'Thursday', friday: 'Friday', saturday: 'Saturday', sunday: 'Sunday',
};

export function formatDate(d: string): string {
  return new Date(`${d}T12:00:00Z`).toLocaleDateString(site.locale, { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
}
export function monthYear(d: string): string {
  return new Date(`${d}T12:00:00Z`).toLocaleDateString(site.locale, { year: 'numeric', month: 'long', timeZone: 'UTC' });
}

function time12(t: string): string {
  const [h, m] = t.split(':').map(Number);
  const suffix = h < 12 ? 'am' : 'pm';
  const hh = h % 12 || 12;
  return m ? `${hh}:${String(m).padStart(2, '0')} ${suffix}` : `${hh} ${suffix}`;
}

/** Hours rows for every weekday: "9 am – 5 pm", "Closed" or "Not listed". */
export function hoursRows(l: Listing): { day: string; text: string }[] {
  return weekdays.map((d) => {
    const v = l.hours[d];
    const text = v === undefined ? 'Not listed' : v === null || !v.length ? 'Closed' : v.map((s) => `${time12(s.opens)} – ${time12(s.closes)}`).join(', ');
    return { day: dayNames[d], text };
  });
}
export const hasHours = (l: Listing) => Object.keys(l.hours).length > 0;

export function attrText(l: Listing, key: string): string | null {
  const def = attributeDefs[key];
  const v = l.attributes[key];
  if (v === undefined) return null;
  if (def.type === 'multi') return (v as string[]).length ? (v as string[]).map((k) => def.options[k]).join(', ') : null;
  if (def.type === 'bool') return v ? 'Yes' : 'No';
  return (v as string[]).length ? (v as string[]).join(', ') : null;
}

export function addressLine(l: Listing): string {
  const a = l.address;
  return [a.street, a.locality, [a.region, a.postalCode].filter(Boolean).join(' ')].filter(Boolean).join(', ');
}

/** Facts table: identical labels on every listing. */
export function factRows(l: Listing): { label: string; value: string | null; href?: string }[] {
  const rows: { label: string; value: string | null; href?: string }[] = [
    { label: 'Address', value: addressLine(l) },
    { label: 'Phone', value: l.phone ?? null, href: l.phone ? `tel:${l.phone.replace(/[^\d+]/g, '')}` : undefined },
    { label: 'Website', value: l.website ? l.website.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '') : null, href: l.website ?? undefined },
  ];
  for (const [key, def] of Object.entries(attributeDefs)) rows.push({ label: def.label, value: attrText(l, key) });
  return rows;
}

/** 3–5 short facts for list cards. */
export function cardFacts(l: Listing): string[] {
  const out: string[] = [];
  for (const [key, def] of Object.entries(attributeDefs)) {
    if (!('card' in def) || !def.card) continue;
    const v = l.attributes[key];
    if (def.type === 'multi' && Array.isArray(v) && v.length) out.push(v.slice(0, 3).map((k) => def.options[k]).join(', '));
    if (def.type === 'bool' && v === true) out.push(def.cardText ?? def.label);
  }
  return out.slice(0, 5);
}

export function mapsUrl(l: Listing): string {
  const q = l.lat != null && l.lng != null ? `${l.lat},${l.lng}` : `${l.name}, ${addressLine(l)}`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}

/** FAQs answered only from the listing's own data. */
export function listingFaqs(l: Entry): { q: string; a: string }[] {
  const faqs: { q: string; a: string }[] = [];
  for (const [key, def] of Object.entries(attributeDefs)) {
    if (!def.question) continue;
    const text = attrText(l, key);
    if (text === null) continue;
    const a = def.type === 'bool' ? `${text}. ${l.name} lists "${def.label.toLowerCase()}" as ${l.attributes[key] ? 'available' : 'not available'}.` : `${l.name} lists: ${text}.`;
    faqs.push({ q: def.question(l.name), a });
  }
  if (hasHours(l)) {
    const sat = l.hours.saturday;
    if (sat !== undefined) faqs.push({ q: `Is ${l.name} open on Saturdays?`, a: sat && sat.length ? `Yes, ${hoursRows(l)[5].text} on Saturdays.` : `No, ${l.name} lists Saturday as closed.` });
  }
  faqs.push({ q: `Where is ${l.name}?`, a: `${addressLine(l)}.` });
  return faqs;
}

/** "Best for" groups built from the data. */
export function bestFor(list: Entry[]): { label: string; listings: Entry[] }[] {
  const groups: { label: string; listings: Entry[] }[] = [];
  for (const [key, def] of Object.entries(attributeDefs)) {
    if (def.type === 'bool' && def.bestFor) groups.push({ label: def.bestFor, listings: list.filter((l) => l.attributes[key] === true) });
    if (def.type === 'multi' && def.bestFor)
      for (const [opt, label] of Object.entries(def.bestFor)) groups.push({ label, listings: list.filter((l) => (l.attributes[key] as string[] | undefined)?.includes(opt)) });
  }
  const sat = list.filter((l) => l.hours.saturday && l.hours.saturday.length);
  const sun = list.filter((l) => l.hours.sunday && l.hours.sunday.length);
  groups.push({ label: 'Open Saturdays', listings: sat }, { label: 'Open Sundays', listings: sun });
  return groups.filter((g) => g.listings.length);
}

export const plural = (n: number) => (n === 1 ? site.entity.singular : site.entity.plural);
export const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

/** Labels for a multi attribute's selected options (short card labels when available). */
export function optionLabels(l: Listing, attr: string, short = false): string[] {
  const def = attributeDefs[attr];
  const v = l.attributes[attr];
  if (!def || def.type !== 'multi' || !Array.isArray(v)) return [];
  return (v as string[]).map((k) => (short && def.short?.[k]) || def.options[k]).filter(Boolean);
}

/** "Virtual + In-person", "Virtual", or null when not listed. */
export function meetingText(l: Listing): string | null {
  const on = Object.entries(site.meetingFormats as Record<string, string>).filter(([k]) => l.attributes[k] === true).map(([, v]) => v);
  return on.length ? on.join(' + ') : null;
}

export const shortUrl = (u: string) => u.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');
