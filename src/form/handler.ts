// "Add your business" submission handler. Pure: I/O (Turnstile, rate limit, duplicate check, email) is injected
// so it can be unit-tested. Spam protection always runs server-side: a honeypot field, a signed time token
// (rejects instant posts and stale ones), a per-IP rate limit, a link-stuffing check, a duplicate check,
// and Cloudflare Turnstile whenever its secret is configured.
import { z } from 'zod';
import site from '../../site.config.ts';
import { attributeDefs, weekdays } from '../lib/schema.ts';

export const paths = {
  form: '/add-your-business/',
  thanks: '/add-your-business/thanks/',
  thanksVerified: '/add-your-business/thanks-verified/',
  /** Sending failed (server side). */
  error: '/add-your-business/error/',
  /** Missing/invalid details or a failed spam check. */
  check: '/add-your-business/check/',
  /** The same submission was already received. */
  received: '/add-your-business/received/',
};

/** A form token must be at least this old (bots post instantly) and at most this old. */
export const TOKEN_MIN_MS = 3_000;
export const TOKEN_MAX_MS = 24 * 3600_000;

export interface Deps {
  /** True when a Turnstile secret is configured; a valid Turnstile token is then required. */
  turnstileRequired: boolean;
  verifyTurnstile(token: string, ip: string | null): Promise<boolean>;
  /** Checks the signed time token the Worker put into the form. */
  verifyFormToken(token: string): Promise<boolean>;
  /** True when this IP has sent too many submissions recently. */
  rateLimited?(ip: string | null): Promise<boolean>;
  /** True when the same submission was received recently (records it otherwise). */
  isDuplicate?(key: string): Promise<boolean>;
  sendEmail(msg: { subject: string; text: string; replyTo: string }): Promise<void>;
  today(): string;
}

export type Result = { location: string; email?: { subject: string; text: string; replyTo: string }; reason?: string };

const optText = (max: number) => z.string().trim().max(max).transform((v) => (v === '' ? null : v));
const optUrl = z
  .string()
  .trim()
  .max(300)
  .transform((v) => (v === '' ? null : /^https?:\/\//i.test(v) ? v : `https://${v}`))
  .pipe(z.url().nullable());

const baseSchema = z.object({
  tier: z.enum(['basic', 'verified']),
  listing: z.string().trim().max(120).regex(/^[a-z0-9-]*$/),
  name: z.string().trim().min(2).max(120),
  street: optText(200),
  locality: z.string().trim().min(1).max(80),
  region: z.string().trim().min(2).max(40),
  postalCode: optText(12),
  phone: optText(40),
  website: optUrl,
  sameAs: z.string().max(1000),
  description: optText(1200),
  submitterName: z.string().trim().min(1).max(100),
  submitterEmail: z.string().trim().max(200).pipe(z.email()),
  relationship: z.enum(['owner', 'staff', 'customer']),
  consent: z.literal('yes'),
});

export const slugify = (s: string) =>
  s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80);

function parseHours(raw: string): { opens: string; closes: string }[] | null | undefined {
  const v = raw.trim().toLowerCase();
  if (!v) return undefined;
  if (v === 'closed') return null;
  const out: { opens: string; closes: string }[] = [];
  for (const part of v.split(',')) {
    const m = part.trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*[-–to]+\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/);
    if (!m) return undefined;
    const t = (h: string, mm: string | undefined, ap: string | undefined) => {
      let hh = Number(h) % 24;
      if (ap === 'pm' && hh < 12) hh += 12;
      if (ap === 'am' && hh === 12) hh = 0;
      return `${String(hh).padStart(2, '0')}:${mm ?? '00'}`;
    };
    out.push({ opens: t(m[1], m[2], m[3]), closes: t(m[4], m[5], m[6]) });
  }
  return out;
}

const clean = (s: string) => s.replace(/[\r\n]+/g, ' ').trim();

export async function handleSubmission(form: FormData, ip: string | null, deps: Deps): Promise<Result> {
  const str = (k: string) => (typeof form.get(k) === 'string' ? (form.get(k) as string) : '');

  // Honeypot: pretend success, send nothing.
  if (str('company_url').trim() !== '') return { location: paths.thanks, reason: 'honeypot' };

  if (deps.rateLimited && (await deps.rateLimited(ip))) return { location: paths.check, reason: 'rate' };
  if (!(await deps.verifyFormToken(str('form_token')))) return { location: paths.check, reason: 'token' };
  if (deps.turnstileRequired) {
    const token = str('cf-turnstile-response');
    if (!token || !(await deps.verifyTurnstile(token, ip))) return { location: paths.check, reason: 'turnstile' };
  }

  const parsed = baseSchema.safeParse(Object.fromEntries(Object.keys(baseSchema.shape).map((k) => [k, str(k)])));
  if (!parsed.success) return { location: paths.check, reason: 'invalid' };
  const d = parsed.data;

  // Link stuffing: real submissions have no links in the name and very few in the description.
  const links = (s: string | null) => (s?.match(/https?:\/\/|www\./gi) ?? []).length;
  if (links(d.name) > 0 || links(d.description) > 2) return { location: paths.check, reason: 'links' };

  // Only owners and staff can request Verified.
  const tierRequested = d.relationship === 'customer' ? 'basic' : d.tier;

  const attributes: Record<string, unknown> = {};
  for (const [key, def] of Object.entries(attributeDefs)) {
    const vals = form.getAll(key).filter((v): v is string => typeof v === 'string');
    if (def.type === 'multi') {
      const ok = [...new Set(vals.filter((v) => v in def.options))];
      if (ok.length) attributes[key] = ok;
    } else if (def.type === 'bool') {
      if (vals.includes('yes')) attributes[key] = true;
    } else {
      const list = (vals[0] ?? '').split(',').map((s) => s.trim()).filter(Boolean).slice(0, 10).map((s) => s.slice(0, 40));
      if (list.length) attributes[key] = list;
    }
  }

  const hours: Record<string, unknown> = {};
  const rawHours: string[] = [];
  for (const day of weekdays) {
    const raw = str(`hours_${day}`).slice(0, 40);
    const h = parseHours(raw);
    if (h !== undefined) hours[day] = h;
    else if (raw.trim()) rawHours.push(`${day}: ${clean(raw)}`);
  }

  const sameAs = d.sameAs
    .split(/\s+/)
    .map((s) => s.trim())
    .filter((s) => /^https?:\/\/\S+$/i.test(s))
    .slice(0, 10);

  const isUpdate = d.listing !== '';
  const listing = {
    name: d.name,
    slug: isUpdate ? d.listing : slugify(d.name),
    status: 'published',
    tier: 'basic',
    verifiedUntil: null,
    address: { street: d.street, locality: d.locality, region: d.region, postalCode: d.postalCode, country: site.country },
    lat: null,
    lng: null,
    phone: d.phone,
    website: d.website,
    sameAs,
    hours,
    summary: null,
    attributes,
    lastUpdated: deps.today(),
    source: 'submission',
    description: d.description,
    bookingUrl: null,
  };

  const tierLabel = tierRequested === 'verified' ? 'Verified request' : 'Basic';
  const subject = `[${site.domain}] ${tierLabel} · ${isUpdate ? `Update: ${listing.slug}` : `New listing: ${clean(d.name)}`}`;
  const action = isUpdate ? `Update listing "${listing.slug}"` : 'Add this listing';
  const instruction =
    tierRequested === 'verified'
      ? `${action} per UPDATING.md as Basic now. Do not upgrade it to Verified until the site owner confirms payment and ownership.`
      : `${action} per UPDATING.md.`;

  const text = [
    instruction,
    '',
    `Suggested file: src/content/listings/{region}/${slugify(d.locality)}/${listing.slug}.json (write "summary" as 1–2 factual third-person sentences; never copy the submitter details below into the file).`,
    '',
    '```json',
    JSON.stringify(listing, null, 2),
    '```',
    '',
    `Tier requested: ${tierRequested === 'verified' ? 'Verified' : 'Basic'}`,
    '',
    'Submitter (private, do not publish)',
    `- Name: ${clean(d.submitterName)}`,
    `- Email: ${clean(d.submitterEmail)}`,
    `- Relationship: ${d.relationship}`,
    ...(d.relationship === 'customer' && d.tier === 'verified' ? ['- Note: a customer chose Verified; treated as Basic.'] : []),
    '',
    'Free text',
    `- Description: ${d.description ?? '(none)'}`,
    ...(rawHours.length ? [`- Hours as typed (could not parse): ${rawHours.join('; ')}`] : []),
  ].join('\n');

  const email = { subject, text, replyTo: clean(d.submitterEmail) };
  const dupKey = [d.name, d.locality, d.submitterEmail, listing.slug].map((x) => x.toLowerCase().replace(/\s+/g, ' ')).join('|');
  if (deps.isDuplicate && (await deps.isDuplicate(dupKey))) return { location: paths.received, reason: 'duplicate' };
  try {
    await deps.sendEmail(email);
  } catch {
    return { location: paths.error, reason: 'send', email };
  }
  return { location: tierRequested === 'verified' ? `${paths.thanksVerified}?ref=${encodeURIComponent(d.name)}` : paths.thanks, email };
}

const toHex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');

async function hmac(key: string, data: string): Promise<string> {
  const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return toHex(await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(data)));
}

/** "{timestamp}.{signature}", put into the form by the Worker each time it serves the page. */
export async function makeFormToken(key: string, now = Date.now()): Promise<string> {
  return `${now}.${await hmac(key, String(now))}`;
}

/** Valid when correctly signed and between TOKEN_MIN_MS and TOKEN_MAX_MS old. */
export async function checkFormToken(key: string, token: string, now = Date.now()): Promise<boolean> {
  const [ts, sig] = token.split('.');
  const t = Number(ts);
  if (!ts || !Number.isFinite(t) || !sig || sig.length !== 64) return false;
  const age = now - t;
  if (age < TOKEN_MIN_MS || age > TOKEN_MAX_MS) return false;
  const expected = await hmac(key, ts);
  let diff = 0;
  for (let i = 0; i < 64; i++) diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
  return diff === 0;
}

/** Raw RFC 5322 message for the send_email binding. */
export function buildMime(msg: { subject: string; text: string; replyTo: string }, from: string, to: string, now = new Date()): string {
  const b64 = (s: string) => btoa(String.fromCharCode(...new TextEncoder().encode(s)));
  const body = b64(msg.text).replace(/.{76}/g, '$&\r\n');
  return [
    `From: ${site.name} forms <${from}>`,
    `To: <${to}>`,
    `Reply-To: <${msg.replyTo.replace(/[<>\s]/g, '')}>`,
    `Subject: =?UTF-8?B?${b64(msg.subject)}?=`,
    `Date: ${now.toUTCString()}`,
    `Message-ID: <${crypto.randomUUID()}@${site.domain}>`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    body,
  ].join('\r\n');
}
