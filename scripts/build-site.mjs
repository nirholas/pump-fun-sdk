#!/usr/bin/env node
/**
 * Assemble the deployable website bundle into dist-site/.
 *
 * Layout:
 *   /            -> website/  (SDK docs & marketing SPA)
 *   /live/       -> live/     (standalone dashboards: launches, trades, vanity)
 *
 * Top-level aliases (/live, /trades, /vanity, /chart) mirror the path
 * carve-outs in the root vercel.json so old links keep working.
 *
 * Output is consumed by wrangler.jsonc (Cloudflare Workers static assets)
 * and by any static host (nginx, etc.).
 */
import { cpSync, mkdirSync, rmSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'dist-site');

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

cpSync(join(root, 'website'), out, {
  recursive: true,
  filter: (src) => !/vercel\.json$|README\.md$/.test(src),
});

mkdirSync(join(out, 'live'), { recursive: true });
for (const f of readdirSync(join(root, 'live'))) {
  if (f.endsWith('.html')) cpSync(join(root, 'live', f), join(out, 'live', f));
}

writeFileSync(
  join(out, '_redirects'),
  [
    '/trades /live/trades 302',
    '/vanity /live/vanity 302',
    '/chart /live/dashboard 302',
    '',
  ].join('\n'),
);

writeFileSync(
  join(out, '_headers'),
  [
    '/*',
    '  X-Content-Type-Options: nosniff',
    '  Referrer-Policy: strict-origin-when-cross-origin',
    '/*.css',
    '  Cache-Control: public, max-age=31536000, immutable',
    '/*.js',
    '  Cache-Control: public, max-age=31536000, immutable',
    '',
  ].join('\n'),
);

const files = readdirSync(out, { recursive: true }).length;
console.log(`dist-site/ assembled (${files} entries)`);
