import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { listingSchema } from './lib/schema.ts';

const listings = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/listings', generateId: ({ entry }) => entry.replace(/\.json$/, '') }),
  schema: listingSchema,
});

const places = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/places', generateId: ({ entry }) => entry.replace(/\.md$/, '') }),
  schema: z.object({ name: z.string().optional() }).strict(),
});

export const collections = { listings, places };
