// Everything niche- or domain-specific lives here (plus src/theme.css, docs/BRIEF.md and the listing files).
// Engine code under src/ reads from this file and holds no niche words.

export type AttributeDef =
  | {
      type: 'multi';
      label: string;
      options: Record<string, string>;
      /** Show on listing cards. */
      card?: boolean;
      /** Build /{segment}/{term}/ pages for this attribute (only terms with 3+ listings). */
      taxonomy?: { segment: string; title: string; heading: (term: string) => string; intro: (term: string) => string };
      /** Per-option "best for" labels on city pages. */
      bestFor?: Record<string, string>;
      /** FAQ on listing pages. */
      question?: (name: string) => string;
      /** City-level landing pages (/{hub}/{region}/{city}/{option}/) when 3+ listings match. */
      cityFacet?: (label: string, where: string) => string;
      /** Short label for cards, e.g. "EA" instead of "Enrolled agent (EA)". */
      short?: Record<string, string>;
    }
  | {
      type: 'bool';
      label: string;
      card?: boolean;
      cardText?: string;
      bestFor?: string;
      question?: (name: string) => string;
    }
  | { type: 'list'; label: string; question?: (name: string) => string };

const credentials = {
  cpa: 'CPA',
  'enrolled-agent': 'Enrolled agent (EA)',
  'tax-attorney': 'Tax attorney',
  afsp: 'IRS Annual Filing Season Program',
  cfp: 'CFP',
};

export const site = {
  domain: 'taxplanners.com',
  name: 'TaxPlanners.com',
  url: 'https://taxplanners.com',
  lang: 'en-US',
  country: 'US',
  locale: 'en-US',
  tagline: 'Find a tax planner near you, with credentials and services side by side.',
  description:
    'A free, independent directory of tax planners in the United States: CPAs, enrolled agents and tax attorneys, listed by state and city with credentials, services and hours.',

  // Business settings (fill in per domain)
  forSaleContact: 'mailto:hello@taxplanners.com?subject=taxplanners.com',
  submissionsEmail: 'hello@taxplanners.com',
  senderEmail: 'forms@taxplanners.com',
  verifiedPrice: '$99/year',
  verifiedPaymentLink: 'mailto:hello@taxplanners.com?subject=Verified%20listing%20payment',
  /** Append ?{param}={business name} to the payment link, if the provider supports it (e.g. Stripe: client_reference_id). */
  paymentReferenceParam: '',
  turnstileSiteKey: '',
  operator: 'TaxPlanners.com is run by an independent publisher. It is not affiliated with the IRS, any state board of accountancy or any firm listed.',

  // Home page and search
  headline: 'Find a tax professional you can verify',
  heroCopy: 'Compare credentials, services, specialties and verification status from tax professionals near you.',
  locationPlaceholder: 'City, state or ZIP',
  needLabel: 'Service or credential',
  trustSignals: ['Credentials checked for Verified listings', 'Independent directory', 'Free Basic listings', 'No paid reviews or ratings'],
  popularSearches: [
    { label: 'CPAs', attr: 'credentials', key: 'cpa' },
    { label: 'Enrolled agents', attr: 'credentials', key: 'enrolled-agent' },
    { label: 'Tax attorneys', attr: 'credentials', key: 'tax-attorney' },
    { label: 'Tax planning', attr: 'services', key: 'tax-planning' },
    { label: 'Small business', attr: 'clients', key: 'small-business' },
    { label: 'Real estate investors', attr: 'clients', key: 'real-estate-investors' },
    { label: 'IRS representation', attr: 'services', key: 'irs-representation' },
    { label: 'Freelancers', attr: 'clients', key: 'self-employed' },
    { label: 'Tax preparation', attr: 'services', key: 'tax-preparation' },
  ],
  /** Attributes shown as "Meeting format" (bool attribute key → label). */
  meetingFormats: { virtual: 'Virtual', inPerson: 'In-person' },
  professional: 'tax professional',

  // Trust wording, used on About, the footer, the Verified popover and llms.txt
  independence:
    'TaxPlanners.com is not affiliated with the IRS, state boards of accountancy, or any listed professional or firm.',
  verifiedMeaning:
    'Verified means the business owner has confirmed the business information and the stated professional credentials have been checked against the relevant public source where applicable.',
  verifiedNotEndorsement: 'Verified does not mean TaxPlanners.com recommends, endorses, or guarantees the professional.',

  // Entity wording
  entity: { singular: 'tax planner', plural: 'tax planners', article: 'a' },
  hub: 'tax-planners',
  regionWord: 'state',
  /** Used in meta descriptions: "{n} tax planners in Austin, TX: {factsPhrase}." */
  factsPhrase: 'credentials, services, virtual meetings and hours',
  schemaType: 'AccountingService',

  // Tier wording (same text on every page, form, email and llms.txt)
  credentialCheck:
    "we check each named professional's credential in the IRS Directory of Federal Tax Return Preparers, or with the state board of accountancy for CPAs",
  credentialCheckShort: 'credential-checked',
  credentialName: 'credential (CPA licence, enrolled agent status or bar admission)',
  credentialSource: 'the IRS Directory of Federal Tax Return Preparers or the state board of accountancy',

  attributes: {
    credentials: {
      type: 'multi',
      label: 'Credentials',
      options: credentials,
      card: true,
      taxonomy: {
        segment: 'credentials',
        title: 'Browse by credential',
        heading: (t: string) => `${t} tax planners`,
        intro: (t: string) => `Tax planners listing the ${t} credential. Check any credential yourself in the IRS Directory of Federal Tax Return Preparers.`,
      },
      question: (n: string) => `What credentials does ${n} list?`,
      cityFacet: (label: string, where: string) => `${label} tax planners in ${where}`,
      short: { 'enrolled-agent': 'Enrolled agent', afsp: 'IRS AFSP' },
    },
    services: {
      type: 'multi',
      label: 'Services',
      card: true,
      options: {
        'tax-planning': 'Tax planning',
        'tax-preparation': 'Tax return preparation',
        'irs-representation': 'IRS representation',
        'business-tax': 'Business tax',
        'estate-trust': 'Estate and trust tax',
        'bookkeeping-payroll': 'Bookkeeping and payroll',
      },
      bestFor: { 'irs-representation': 'IRS representation', 'business-tax': 'Business tax' },
      question: (n: string) => `What services does ${n} offer?`,
      cityFacet: (label: string, where: string) => `${label} in ${where}`,
    },
    clients: {
      type: 'multi',
      label: 'Works with',
      options: {
        individuals: 'Individuals and families',
        'self-employed': 'Self-employed and freelancers',
        'small-business': 'Small businesses',
        'real-estate-investors': 'Real estate investors',
        'high-income': 'High-income households',
        expats: 'Expats and multi-state filers',
      },
      bestFor: { 'self-employed': 'Self-employed', 'real-estate-investors': 'Real estate investors', expats: 'Expats and multi-state' },
      cityFacet: (label: string, where: string) => `Tax planners in ${where} for ${label.toLowerCase()}`,
      short: { individuals: 'Individuals', 'self-employed': 'Freelancers', 'high-income': 'High income', expats: 'Expats' },
    },
    virtual: { type: 'bool', label: 'Virtual meetings', card: true, cardText: 'Virtual meetings', bestFor: 'Virtual meetings', question: (n: string) => `Does ${n} offer virtual meetings?` },
    inPerson: { type: 'bool', label: 'In-person meetings' },
    freeConsultation: { type: 'bool', label: 'Free first consultation', card: true, cardText: 'Free first consultation', bestFor: 'Free first consultation', question: (n: string) => `Does ${n} offer a free first consultation?` },
    yearRound: { type: 'bool', label: 'Open year-round', bestFor: 'Open year-round' },
    wheelchairAccessible: { type: 'bool', label: 'Wheelchair accessible', bestFor: 'Wheelchair accessible' },
    languages: { type: 'list', label: 'Languages', question: (n: string) => `Which languages does ${n} work in?` },
  } satisfies Record<string, AttributeDef>,

  homeFaqs: [
    {
      q: 'What does a tax planner do?',
      a: 'A tax planner looks at your income, business and investments during the year and suggests legal ways to lower the tax you owe, such as timing income, retirement contributions or choosing a business structure. Many also prepare and file the return.',
    },
    {
      q: 'Tax planner, tax preparer or CPA: what is the difference?',
      a: 'Anyone with an IRS Preparer Tax Identification Number (PTIN) can prepare returns. CPAs are licensed by a state board of accountancy; enrolled agents are licensed by the IRS; tax attorneys are admitted to a state bar. "Tax planner" describes the work, not a licence, so check the credential each listing shows.',
    },
    {
      q: 'How much does tax planning cost?',
      a: 'Prices vary by firm and by how complex your situation is. Planning is usually sold as a flat fee per engagement or at an hourly rate. We do not publish prices; ask each firm for a written quote.',
    },
    {
      q: "How do I check a tax planner's credentials?",
      a: 'Search the IRS Directory of Federal Tax Return Preparers with Credentials and Select Qualifications (irs.treasury.gov/rpo). For CPAs, your state board of accountancy also publishes licence status.',
    },
  ],
  sources: [
    { name: 'IRS Directory of Federal Tax Return Preparers', url: 'https://irs.treasury.gov/rpo/rpo.jsf' },
    { name: 'IRS: Choosing a tax professional', url: 'https://www.irs.gov/tax-professionals/choosing-a-tax-professional' },
  ],
} as const;

export type Site = typeof site;
export default site;
