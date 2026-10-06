import { defineCollection } from 'astro:content';
import { file, glob } from 'astro/loaders';
import { z } from 'zod';

const projects = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/projects' }),
  schema: ({ image }) =>
    z.object({
      name: z.string(),
      description: z.string(),
      tags: z.array(z.string()),
      github: z.url(),
      links: z.array(z.object({ label: z.string(), href: z.url() })).default([]),
      images: z.array(image()).default([]),
    }),
});

const certifications = defineCollection({
  loader: file('./src/content/certifications/certifications.json'),
  schema: ({ image }) =>
    z.object({
      order: z.number(),
      name: z.string(),
      badge: z.object({ src: image(), alt: z.string() }).optional(),
      credlyUrl: z.url().optional(),
      status: z.enum(['upcoming']).optional(),
      label: z.string().optional(),
    }),
});

const skills = defineCollection({
  loader: file('./src/content/skills/skills.json'),
  schema: z.object({
    order: z.number(),
    group: z.string(),
    items: z.array(z.string()),
  }),
});

export const collections = { projects, certifications, skills };
