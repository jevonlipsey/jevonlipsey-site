import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const research = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/research' }),
  schema: z.object({
    title: z.string(),
    venue: z.string(),
    year: z.number(),
    status: z.enum(['published', 'in-review', 'preprint']),
    authors: z.array(z.string()),
    abstract: z.string(),
    pdf: z.string().optional(),
    code: z.string().optional(),
    bibtex: z.string().optional(),
    featured: z.boolean().default(false),
  }),
});

const thoughts = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/thoughts' }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    summary: z.string(),
    tags: z.array(z.string()).default([]),
    draft: z.boolean().default(false),
  }),
});

export const collections = {
  research,
  thoughts,
};
