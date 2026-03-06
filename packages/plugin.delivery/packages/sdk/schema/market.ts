import { z } from 'zod';

import { pluginManifestSchema } from './manifest';

export const pluginMetaSchema = z.object({
  author: z.string(),
  createdAt: z.string(),
  homepage: z.string(),
  identifier: z.string(),
  manifest: z.string(),
  meta: z.object({
    avatar: z.string().optional(),
    tags: z.array(z.string()).optional(),
  }),
  schemaVersion: z.number(),
});

export const marketIndexSchema = z.object({
  plugins: z.array(z.any()),
  schemaVersion: z.number(),
});

export const pluginRequestPayloadSchema = z.object({
  apiName: z.string(),
  arguments: z.string().optional(),
  identifier: z.string(),
  indexUrl: z.string().optional(),
  manifest: pluginManifestSchema.optional(),
  type: z.string().optional(),
});

export type PluginRequestPayload = z.infer<typeof pluginRequestPayloadSchema>;
