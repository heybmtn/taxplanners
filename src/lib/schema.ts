// Listing file schema, built from the attribute definitions in site.config.ts.
// Shared by the content collection (build) and the form Worker (submissions).
import { z } from 'zod';
import site, { type AttributeDef } from '../../site.config.ts';

export const attributeDefs = site.attributes as Record<string, AttributeDef>;

const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'lowercase-words-with-dashes');
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD');
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'HH:MM (24h)');

export const weekdays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;
export type Weekday = (typeof weekdays)[number];

/** One day: null = closed, [] = unknown is represented by omitting the day. */
const dayHours = z.array(z.object({ opens: time, closes: time })).nullable();

export function attributesSchema() {
  const shape: Record<string, z.ZodType> = {};
  for (const [key, def] of Object.entries(attributeDefs)) {
    if (def.type === 'multi') shape[key] = z.array(z.enum(Object.keys(def.options) as [string, ...string[]])).optional();
    else if (def.type === 'bool') shape[key] = z.boolean().optional();
    else shape[key] = z.array(z.string().max(40)).optional();
  }
  return z.object(shape).strict();
}

export const listingSchema = z
  .object({
    name: z.string().min(2).max(120),
    slug,
    status: z.enum(['published', 'closed']).default('published'),
    tier: z.enum(['basic', 'verified']).default('basic'),
    verifiedUntil: date.nullable().optional(),
    demo: z.boolean().optional(),
    address: z.object({
      street: z.string().max(200).nullable().optional(),
      locality: z.string().min(1).max(80),
      region: z.string().min(2).max(40),
      postalCode: z.string().max(12).nullable().optional(),
      country: z.string().length(2).default(site.country),
    }),
    lat: z.number().min(-90).max(90).nullable().optional(),
    lng: z.number().min(-180).max(180).nullable().optional(),
    phone: z.string().max(40).nullable().optional(),
    website: z.string().url().nullable().optional(),
    sameAs: z.array(z.string().url()).default([]),
    hours: z.partialRecord(z.enum(weekdays), dayHours).default({}),
    summary: z.string().min(10).max(400),
    attributes: attributesSchema().default({}),
    lastUpdated: date,
    source: z.string().min(1).max(200),
    // Verified-only (ignored on Basic)
    description: z.string().max(1200).nullable().optional(),
    bookingUrl: z.string().url().nullable().optional(),
  })
  .strict();

export type Listing = z.infer<typeof listingSchema>;
