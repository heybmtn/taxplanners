// The only place tier wording is written. Every page, markdown twin, llms.txt and email uses these strings.
import site from '../../site.config.ts';

const e = site.entity;

export const tierName = { basic: 'Basic', verified: 'Verified' } as const;
export const plansUrl = '/listing-plans/';
export const formUrl = '/add-your-business/';

export const copy = {
  badge: 'Verified',
  disclosure: 'Verified listings are paid, checked and shown first.',
  disclosureLink: 'Listing plans',
  verifiedNote: 'Verified: details confirmed by the owner',
  basicCta: 'Is this your business? Get it Verified or send a correction',
  verifiedCta: 'Update this listing',
  footer: `${site.name} is an independent directory. Basic listings are free. Verified listings are paid, ${site.credentialCheckShort}, labelled and shown first. No ratings, reviews or referral fees.`,
  basicDefinition: `Basic (free): any ${e.singular} can be listed. Details come from public sources or a submission and show the date they were last updated. Basic listings have no badge and are not checked by the owner.`,
  verifiedDefinition: `Verified (paid, ${site.verifiedPrice}): the owner has confirmed they run the business and confirmed the details, and ${site.credentialCheck}. Verified listings carry the Verified label and are shown first. Verified is never a rating, and payment never changes the facts we publish.`,
  ordering: 'Verified listings first, then Basic; within each, the most complete listings first, then A–Z.',
};

export const isMailto = site.verifiedPaymentLink.startsWith('mailto:');
export const payLabel = isMailto ? 'Email us to pay' : 'Pay now';
export const payEmail = isMailto ? site.verifiedPaymentLink.slice(7).split('?')[0] : null;

export function paymentLink(businessName?: string): string {
  if (!businessName || !site.paymentReferenceParam || isMailto) return site.verifiedPaymentLink;
  const u = new URL(site.verifiedPaymentLink);
  u.searchParams.set(site.paymentReferenceParam, businessName.slice(0, 200));
  return u.toString();
}
