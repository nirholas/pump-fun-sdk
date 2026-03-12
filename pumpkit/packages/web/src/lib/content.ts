/* ── Content registry ──────────────────────────────────────────────
 * Uses Vite's import.meta.glob to load all markdown docs & tutorials
 * as raw strings at build time. No need to list every file manually.
 */

// Docs — top-level markdown files in pumpkit/docs/
const docModules = import.meta.glob('/../../docs/*.md', { query: '?raw', import: 'default' });

// Guides — docs/guides/*.md
const guideModules = import.meta.glob('/../../docs/guides/*.md', { query: '?raw', import: 'default' });

// Tutorials — pumpkit/tutorials/*.md
const tutorialModules = import.meta.glob('/../../tutorials/*.md', { query: '?raw', import: 'default' });

// ── Helpers ──────────────────────────────────────────────────────

function slugFromPath(path: string): string {
  const filename = path.split('/').pop() ?? '';
  return filename.replace(/\.md$/, '');
}

function titleFromSlug(slug: string): string {
  return slug
    .replace(/^\d+-/, '') // strip leading number prefix like "01-"
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export interface ContentEntry {
  slug: string;
  title: string;
  loader: () => Promise<string>;
  category: 'doc' | 'guide' | 'tutorial';
}

function buildEntries(
  modules: Record<string, () => Promise<unknown>>,
  category: ContentEntry['category'],
): ContentEntry[] {
  return Object.entries(modules)
    .map(([path, loader]) => {
      const slug = slugFromPath(path);
      if (slug === 'README') return null;
      return {
        slug,
        title: titleFromSlug(slug),
        loader: loader as () => Promise<string>,
        category,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a!.slug.localeCompare(b!.slug, undefined, { numeric: true })) as ContentEntry[];
}

export const docs: ContentEntry[] = buildEntries(docModules, 'doc');
export const guides: ContentEntry[] = buildEntries(guideModules, 'guide');
export const tutorials: ContentEntry[] = buildEntries(tutorialModules, 'tutorial');

// All content, flattened
export const allContent: ContentEntry[] = [...docs, ...guides, ...tutorials];

// Lookup helpers
export function findDoc(slug: string): ContentEntry | undefined {
  return docs.find((d) => d.slug === slug) ?? guides.find((g) => g.slug === slug);
}

export function findTutorial(slug: string): ContentEntry | undefined {
  return tutorials.find((t) => t.slug === slug);
}
