// Listing plans content, shared by /listing-plans/, its markdown twin and llms.txt.
import site from '../../site.config.ts';
import { copy, formUrl, isMailto, payEmail } from './copy.ts';

const e = site.entity;
const attrLabels = Object.values(site.attributes).slice(0, 3).map((a) => a.label.toLowerCase()).join(', ');

export const plans = {
  h1: `List your ${e.singular}: Basic or Verified`,
  intro: `Every ${e.singular} can have a free Basic listing. Verified is paid: ${site.credentialCheck}, confirm the details with the owner, label the listing Verified and show it first in its city and category lists. Verified is never a rating, and payment never changes the facts we publish.`,
  basic: [
    'Core facts: name, address, phone, website and hours',
    `Key details: ${attrLabels}`,
    `Listed on city, ${site.regionWord} and category pages`,
    'Update it any time with the form',
  ],
  verified: [
    'Everything in Basic',
    `Credential check (${site.credentialName}) plus owner confirmation`,
    'The Verified label on every page that shows the listing',
    'Shown first, above Basic listings, plus your own description and booking link',
    'Rechecked at each renewal',
  ],
  steps: [
    `Send your details with the form and choose "Verified", or use "Is this your business?" on your listing.`,
    isMailto ? `Pay ${site.verifiedPrice}: email ${payEmail} and we'll send an invoice.` : `Pay ${site.verifiedPrice} with the payment link.`,
    `We check the ${site.credentialName} with ${site.credentialSource} and confirm the details with you. If the check fails we refund you and the listing stays Basic.`,
    'The listing gets the Verified label and moves above Basic listings. It is rechecked at renewal and returns to Basic if not renewed.',
  ],
  faqs: [
    { q: 'Is a Basic listing really free?', a: `Yes. We never hide a correct Basic listing because a nearby ${e.singular} paid.` },
    { q: 'Does paying change what you publish?', a: 'No. It buys the label, the check and a place above Basic listings, never a rating, a review or changed facts.' },
    { q: 'How are listings ordered?', a: copy.ordering },
    { q: 'How much does Verified cost?', a: `${site.verifiedPrice}.` },
  ],
  sendLabel: `Send your ${e.singular}'s details`,
  sendUrl: `${formUrl}?tier=verified`,
};

/** Basic vs Verified comparison. Every row is something the site actually does today. */
export const comparison: { feature: string; basic: boolean; verified: boolean }[] = [
  { feature: 'Directory listing (city, state and search pages)', basic: true, verified: true },
  { feature: 'Business information: address, phone, website, hours', basic: true, verified: true },
  { feature: 'Credentials, services and client types displayed', basic: true, verified: true },
  { feature: 'Update any time with the form', basic: true, verified: true },
  { feature: 'Owner confirmation of the details', basic: false, verified: true },
  { feature: `Credential check with ${site.credentialSource}`, basic: false, verified: true },
  { feature: 'Verified badge', basic: false, verified: true },
  { feature: 'Shown first, above Basic listings', basic: false, verified: true },
  { feature: 'Your own description', basic: false, verified: true },
  { feature: 'Booking link', basic: false, verified: true },
  { feature: 'Rechecked at each annual renewal', basic: false, verified: true },
];

/** The verification process in four steps (home page, /verification/). */
export const howItWorks = [
  { title: 'The owner applies', text: `The owner or a staff member sends the business details and chooses Verified (${site.verifiedPrice}).` },
  { title: 'We confirm the business', text: 'We confirm with the owner, using the contact details on the listing, that they run the business and that the details are right.' },
  { title: 'We check the credential', text: `We look up each stated ${site.credentialName} in ${site.credentialSource}. If it does not check out, the listing stays Basic and we refund.` },
  { title: 'The badge appears', text: 'The listing shows the Verified badge until its renewal date. It is rechecked at renewal and returns to Basic if not renewed.' },
];
