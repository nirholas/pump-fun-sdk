import { z } from 'zod';

const JSONSchema = z.object({
  properties: z.object({}),
  required: z.array(z.string()).optional(),
  type: z.enum(['object']),
});
export const pluginApiSchema = z.object({
  description: z.string(),
  name: z.string(),
  parameters: JSONSchema,
  url: z.string().url().optional(),
});

export const pluginManifestSchema = z.object({
  api: z.array(pluginApiSchema),
  author: z.string().optional(),
  createAt: z.string().optional(),
  gateway: z.string().optional(),
  homepage: z.string().optional(),
  identifier: z.string(),
  meta: z.object({
    avatar: z.string().optional(),
    description: z.string().optional(),
    tags: z.array(z.string()).optional(),
    title: z.string().optional(),
  }),
  openapi: z.string().optional(),
  settings: JSONSchema.optional(),
  systemRole: z.string().optional(),
  type: z.enum(['default', 'markdown', 'standalone']).optional(),
  ui: z
    .object({
      height: z.number().optional(),
      mode: z.enum(['iframe', 'module']).optional(),
      url: z.string(),
      width: z.number().optional(),
    })
    .optional(),
});
