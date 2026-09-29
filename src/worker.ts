// Handles only /add-your-business/ (form GET prefill and POST) and the Verified thanks page.
// Every other request is served straight from static assets (see run_worker_first in wrangler.jsonc).
import { EmailMessage } from 'cloudflare:email';
import site from '../site.config.ts';
import { buildMime, handleSubmission, paths } from './form/handler.ts';
import { paymentLink } from './lib/copy.ts';

interface Env {
  ASSETS: Fetcher;
  EMAIL: SendEmail;
  TURNSTILE_SECRET?: string;
}

const redirect = (location: string, url: URL) => new Response(null, { status: 303, headers: { Location: new URL(location, url).toString(), 'Cache-Control': 'no-store' } });

async function verifyTurnstile(secret: string | undefined, token: string, ip: string | null): Promise<boolean> {
  if (!secret) return false; // fail closed
  const body = new FormData();
  body.append('secret', secret);
  body.append('response', token);
  if (ip) body.append('remoteip', ip);
  try {
    const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body });
    return ((await r.json()) as { success?: boolean }).success === true;
  } catch {
    return false;
  }
}

const escAttr = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

async function prefillForm(req: Request, env: Env, url: URL): Promise<Response> {
  const res = await env.ASSETS.fetch(req);
  const slug = (url.searchParams.get('listing') ?? '').toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 120);
  const wantsVerified = url.searchParams.get('tier') === 'verified';
  if (!slug && !wantsVerified) return res;

  let name = '';
  if (slug) {
    const data = await env.ASSETS.fetch(new Request(new URL('/data/listings.json', url)));
    if (data.ok) {
      const { listings } = (await data.json()) as { listings: { slug: string; name: string; tier: string }[] };
      name = listings.find((l) => l.slug === slug)?.name ?? '';
    }
  }
  let rw = new HTMLRewriter();
  if (slug && name) {
    rw = rw
      .on('input[name="listing"]', { element: (el) => void el.setAttribute('value', slug) })
      .on('input[name="name"]', { element: (el) => void el.setAttribute('value', name) })
      .on('#update-note', {
        element: (el) => {
          el.removeAttribute('hidden');
          el.setInnerContent(`<strong>Updating:</strong> ${escAttr(name)}. Fill in only what has changed, plus your details below.`, { html: true });
        },
      });
  }
  if (wantsVerified) {
    rw = rw
      .on('input[name="tier"][value="basic"]', { element: (el) => void el.removeAttribute('checked') })
      .on('input[name="tier"][value="verified"]', { element: (el) => void el.setAttribute('checked', '') });
  }
  const out = rw.transform(res);
  const headers = new Headers(out.headers);
  headers.set('Cache-Control', 'no-store');
  return new Response(out.body, { status: out.status, headers });
}

async function thanksVerified(req: Request, env: Env, url: URL): Promise<Response> {
  const res = await env.ASSETS.fetch(req);
  const ref = (url.searchParams.get('ref') ?? '').slice(0, 120);
  if (!ref || !site.paymentReferenceParam) return res;
  return new HTMLRewriter().on('a#pay', { element: (el) => void el.setAttribute('href', paymentLink(ref)) }).transform(res);
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname === paths.form && req.method === 'POST') {
      let form: FormData;
      try {
        form = await req.formData();
      } catch {
        return redirect(paths.error, url);
      }
      const result = await handleSubmission(form, req.headers.get('CF-Connecting-IP'), {
        today: () => new Date().toISOString().slice(0, 10),
        verifyTurnstile: (token, ip) => verifyTurnstile(env.TURNSTILE_SECRET, token, ip),
        sendEmail: async (msg) => {
          const raw = buildMime(msg, site.senderEmail, site.submissionsEmail);
          await env.EMAIL.send(new EmailMessage(site.senderEmail, site.submissionsEmail, raw));
        },
      });
      return redirect(result.location, url);
    }
    if (url.pathname === paths.form && (req.method === 'GET' || req.method === 'HEAD')) return prefillForm(req, env, url);
    if (url.pathname === paths.thanksVerified) return thanksVerified(req, env, url);
    if (url.pathname === paths.form) return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET, HEAD, POST' } });
    return env.ASSETS.fetch(req);
  },
} satisfies ExportedHandler<Env>;
