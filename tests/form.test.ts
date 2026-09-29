import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handleSubmission, buildMime, checkFormToken, makeFormToken, paths, type Deps } from '../src/form/handler.ts';
import { listingSchema } from '../src/lib/schema.ts';

function form(over: Record<string, string | string[]> = {}): FormData {
  const base: Record<string, string | string[]> = {
    tier: 'basic', listing: '', name: 'Example Tax Co', street: '1 Main St', locality: 'Austin', region: 'TX', postalCode: '78701',
    phone: '+1 555 0100', website: 'example.com', sameAs: 'https://www.linkedin.com/company/example\nnot-a-url', description: 'We plan taxes.',
    submitterName: 'Pat Owner', submitterEmail: 'pat@example.com', relationship: 'owner', consent: 'yes', company_url: '',
    'cf-turnstile-response': 'token', form_token: 'good', credentials: ['cpa', 'bogus'], virtual: 'yes', languages: 'English, Spanish',
    hours_monday: '9:00-17:00', hours_sunday: 'closed', hours_tuesday: 'by appointment',
  };
  const f = new FormData();
  for (const [k, v] of Object.entries({ ...base, ...over })) for (const x of [v].flat()) f.append(k, x);
  return f;
}

function deps(opts: { turnstile?: boolean; required?: boolean; fail?: boolean; limited?: boolean; dup?: boolean } = {}) {
  const sent: { subject: string; text: string; replyTo: string }[] = [];
  const d: Deps = {
    today: () => '2026-09-29',
    turnstileRequired: opts.required ?? true,
    verifyTurnstile: async () => opts.turnstile ?? true,
    verifyFormToken: async (t) => t === 'good',
    rateLimited: async () => opts.limited ?? false,
    isDuplicate: async () => opts.dup ?? false,
    sendEmail: async (m) => {
      if (opts.fail) throw new Error('send failed');
      sent.push(m);
    },
  };
  return { d, sent };
}

const jsonBlock = (text: string) => JSON.parse(text.split('```json\n')[1].split('\n```')[0]);

test('valid Basic submission emails a listing-shaped JSON block', async () => {
  const { d, sent } = deps();
  const r = await handleSubmission(form(), '1.2.3.4', d);
  assert.equal(r.location, paths.thanks);
  assert.equal(sent.length, 1);
  const m = sent[0];
  assert.equal(m.subject, '[taxplanners.com] Basic · New listing: Example Tax Co');
  assert.match(m.text, /^Add this listing per UPDATING\.md\./);
  assert.match(m.text, /\nTier requested: Basic\n/);
  const j = jsonBlock(m.text);
  assert.equal(j.tier, 'basic');
  assert.equal(j.source, 'submission');
  assert.equal(j.summary, null);
  assert.equal(j.slug, 'example-tax-co');
  assert.equal(j.website, 'https://example.com');
  assert.deepEqual(j.sameAs, ['https://www.linkedin.com/company/example']);
  assert.deepEqual(j.attributes, { credentials: ['cpa'], virtual: true, languages: ['English', 'Spanish'] });
  assert.deepEqual(j.hours, { monday: [{ opens: '09:00', closes: '17:00' }], sunday: null });
  assert.match(m.text, /could not parse\): tuesday: by appointment/);
  assert.ok(!JSON.stringify(j).includes('pat@example.com'), 'submitter details stay out of the listing JSON');
  // Once the agent writes a summary, the block is a valid listing file.
  assert.ok(listingSchema.safeParse({ ...j, summary: 'Example Tax Co is a tax firm in Austin.' }).success);
});

test('Verified request by owner: instruction says keep Basic until payment and ownership are confirmed', async () => {
  const { d, sent } = deps();
  const r = await handleSubmission(form({ tier: 'verified' }), null, d);
  assert.equal(r.location, `${paths.thanksVerified}?ref=Example%20Tax%20Co`);
  assert.equal(sent[0].subject, '[taxplanners.com] Verified request · New listing: Example Tax Co');
  assert.match(sent[0].text, /^Add this listing per UPDATING\.md as Basic now\. Do not upgrade it to Verified until the site owner confirms payment and ownership\./);
  assert.match(sent[0].text, /\nTier requested: Verified\n/);
  assert.equal(jsonBlock(sent[0].text).tier, 'basic');
});

test('a customer cannot request Verified', async () => {
  const { d, sent } = deps();
  const r = await handleSubmission(form({ tier: 'verified', relationship: 'customer' }), null, d);
  assert.equal(r.location, paths.thanks);
  assert.match(sent[0].subject, /\] Basic · /);
});

test('update subject uses the slug', async () => {
  const { d, sent } = deps();
  await handleSubmission(form({ listing: 'demo-tax-planner-3' }), null, d);
  assert.equal(sent[0].subject, '[taxplanners.com] Basic · Update: demo-tax-planner-3');
  assert.match(sent[0].text, /^Update listing "demo-tax-planner-3" per UPDATING\.md\./);
});

test('honeypot: pretend success, send nothing', async () => {
  const { d, sent } = deps();
  const r = await handleSubmission(form({ company_url: 'http://spam' }), null, d);
  assert.equal(r.location, paths.thanks);
  assert.equal(sent.length, 0);
});

test('bad or missing Turnstile fails closed when Turnstile is configured', async () => {
  const bad = deps({ turnstile: false });
  assert.equal((await handleSubmission(form(), null, bad.d)).location, paths.check);
  assert.equal(bad.sent.length, 0);
  const missing = deps();
  assert.equal((await handleSubmission(form({ 'cf-turnstile-response': '' }), null, missing.d)).location, paths.check);
  assert.equal(missing.sent.length, 0);
});

test('without Turnstile configured, the form still works (server-side checks only)', async () => {
  const { d, sent } = deps({ required: false, turnstile: false });
  assert.equal((await handleSubmission(form({ 'cf-turnstile-response': '' }), null, d)).location, paths.thanks);
  assert.equal(sent.length, 1);
});

test('spam checks: missing form token, rate limit, link stuffing', async () => {
  const a = deps();
  assert.equal((await handleSubmission(form({ form_token: '' }), null, a.d)).reason, 'token');
  assert.equal((await handleSubmission(form(), null, deps({ limited: true }).d)).reason, 'rate');
  assert.equal((await handleSubmission(form({ name: 'Cheap pills http://spam.example' }), null, a.d)).reason, 'links');
  assert.equal((await handleSubmission(form({ description: 'a http://x.co b http://y.co c www.z.co' }), null, a.d)).reason, 'links');
  assert.equal(a.sent.length, 0);
});

test('duplicate submissions are not sent twice', async () => {
  const { d, sent } = deps({ dup: true });
  const r = await handleSubmission(form(), null, d);
  assert.equal(r.location, paths.received);
  assert.equal(sent.length, 0);
});

test('invalid input goes to the check page; send failure to the error page', async () => {
  const a = deps();
  assert.equal((await handleSubmission(form({ consent: '' }), null, a.d)).location, paths.check);
  assert.equal((await handleSubmission(form({ submitterEmail: 'nope' }), null, a.d)).location, paths.check);
  assert.equal((await handleSubmission(form({ name: 'x'.repeat(500) }), null, a.d)).location, paths.check);
  assert.equal(a.sent.length, 0);
  assert.equal((await handleSubmission(form(), null, deps({ fail: true }).d)).location, paths.error);
});

test('form tokens: valid after 3 seconds, rejected when instant, stale, tampered or signed with another key', async () => {
  const now = 1_800_000_000_000;
  const t = await makeFormToken('k', now);
  assert.equal(await checkFormToken('k', t, now + 5_000), true);
  assert.equal(await checkFormToken('k', t, now + 500), false);
  assert.equal(await checkFormToken('k', t, now + 25 * 3600_000), false);
  assert.equal(await checkFormToken('other', t, now + 5_000), false);
  assert.equal(await checkFormToken('k', t.replace(/^\d/, '9'), now + 5_000), false);
  assert.equal(await checkFormToken('k', 'garbage', now + 5_000), false);
});

test('MIME message is well formed', () => {
  const raw = buildMime({ subject: 'Hé · test', text: 'body', replyTo: 'a@b.c\r\nBcc: x@y.z' }, 'forms@taxplanners.com', 'hello@taxplanners.com');
  assert.match(raw, /^From: .*<forms@taxplanners\.com>\r\n/);
  assert.match(raw, /\r\nSubject: =\?UTF-8\?B\?/);
  assert.ok(!/\r\nBcc:/.test(raw));
});
