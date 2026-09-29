// Runs only for /search/, /add-your-business/ (form GET and POST) and the Verified thanks page,
// plus a daily cron that calls the Workers Builds deploy hook so expired Verified listings drop to Basic.
// Every other request is served straight from static assets (see run_worker_first in wrangler.jsonc).
import { EmailMessage } from 'cloudflare:email';
import site from '../site.config.ts';
import { buildMime, checkFormToken, handleSubmission, makeFormToken, paths } from './form/handler.ts';
import { paymentLink } from './lib/copy.ts';
import { renderSearch } from './search-page.ts';

interface Env {
  ASSETS: Fetcher;
  EMAIL: SendEmail;
  /** Optional: Turnstile secret. When set, a valid Turnstile token is required on every submission. */
  TURNSTILE_SECRET?: string;
  /** Optional but recommended: secret used to sign form tokens. */
  FORM_SECRET?: string;
  /** Optional rate limiting binding (wrangler.jsonc "ratelimits"). */
  FORM_RATE_LIMITER?: RateLimit;
  /** Workers Builds deploy hook URL (secret). Without it the daily rebuild is skipped. */
  DEPLOY_HOOK_URL?: string;
}

const redirect = (location: string, url: URL) =>
  new Response(null, { status: 303, headers: { Location: new URL(location, url).toString(), 'Cache-Control': 'no-store' } });

const formKey = (env: Env) => env.FORM_SECRET || `${site.domain}:form-token:v1`;

async function verifyTurnstile(secret: string | undefined, token: string, ip: string | null): Promise<boolean> {
  if (!secret) return false;
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

/** Remembers a submission for 10 minutes in the edge cache (per data centre; a no-op on workers.dev). */
async function isDuplicate(key: string): Promise<boolean> {
  try {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key));
    const id = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
    const cacheKey = new Request(`https://${site.domain}/__dedupe/${id}`);
    const cache = (caches as unknown as { default: Cache }).default;
    if (await cache.match(cacheKey)) return true;
    await cache.put(cacheKey, new Response('1', { headers: { 'Cache-Control': 'max-age=600' } }));
  } catch {
    // The duplicate check is best effort.
  }
  return false;
}

const escHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

async function serveForm(req: Request, env: Env, url: URL): Promise<Response> {
  const res = await env.ASSETS.fetch(req);
  const slug = (url.searchParams.get('listing') ?? '').toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 120);
  const wantsVerified = url.searchParams.get('tier') === 'verified';
  const token = await makeFormToken(formKey(env));

  let name = '';
  if (slug) {
    const data = await env.ASSETS.fetch(new Request(new URL('/data/listings.json', url)));
    if (data.ok) {
      const { listings } = (await data.json()) as { listings: { slug: string; name: string }[] };
      name = listings.find((l) => l.slug === slug)?.name ?? '';
    }
  }
  let rw = new HTMLRewriter().on('input[name="form_token"]', { element: (el) => void el.setAttribute('value', token) });
  if (slug && name) {
    rw = rw
      .on('input[name="listing"]', { element: (el) => void el.setAttribute('value', slug) })
      .on('input[name="name"]', { element: (el) => void el.setAttribute('value', name) })
      .on('#update-note', {
        element: (el) => {
          el.removeAttribute('hidden');
          el.setInnerContent(`<p><strong>Updating: ${escHtml(name)}.</strong> Fill in what has changed, plus your details in step 3.</p>`, { html: true });
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
    const read = req.method === 'GET' || req.method === 'HEAD';

    if (url.pathname === '/search/' && read) return renderSearch(req, env.ASSETS, url);

    if (url.pathname === paths.form && req.method === 'POST') {
      const ip = req.headers.get('CF-Connecting-IP');
      let form: FormData;
      try {
        if (Number(req.headers.get('content-length') ?? 0) > 64_000) return redirect(paths.check, url);
        form = await req.formData();
      } catch {
        return redirect(paths.check, url);
      }
      const result = await handleSubmission(form, ip, {
        today: () => new Date().toISOString().slice(0, 10),
        turnstileRequired: !!env.TURNSTILE_SECRET,
        verifyTurnstile: (token, ipAddr) => verifyTurnstile(env.TURNSTILE_SECRET, token, ipAddr),
        verifyFormToken: (token) => checkFormToken(formKey(env), token),
        rateLimited: async (ipAddr) => {
          if (!env.FORM_RATE_LIMITER || !ipAddr) return false;
          try {
            return !(await env.FORM_RATE_LIMITER.limit({ key: ipAddr })).success;
          } catch {
            return false;
          }
        },
        isDuplicate,
        sendEmail: async (msg) => {
          const raw = buildMime(msg, site.senderEmail, site.submissionsEmail);
          await env.EMAIL.send(new EmailMessage(site.senderEmail, site.submissionsEmail, raw));
        },
      });
      if (result.reason && result.reason !== 'duplicate') console.log(`form: ${result.reason}`);
      return redirect(result.location, url);
    }
    if (url.pathname === paths.form && read) return serveForm(req, env, url);
    if (url.pathname === paths.thanksVerified) return thanksVerified(req, env, url);
    if (url.pathname === paths.form) return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET, HEAD, POST' } });
    return env.ASSETS.fetch(req);
  },

  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    if (!env.DEPLOY_HOOK_URL) {
      console.warn('DEPLOY_HOOK_URL is not set; skipping the daily rebuild');
      return;
    }
    ctx.waitUntil(
      fetch(env.DEPLOY_HOOK_URL, { method: 'POST' }).then((r) => {
        if (!r.ok) console.error(`Deploy hook returned ${r.status}`);
      }),
    );
  },
} satisfies ExportedHandler<Env>;
