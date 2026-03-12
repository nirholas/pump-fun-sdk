import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { MarkdownChat } from '../components/MarkdownChat';
import { findDoc, docs, guides } from '../lib/content';

export function DocViewer() {
  const { slug } = useParams<{ slug: string }>();
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const entry = slug ? findDoc(slug) : undefined;

  useEffect(() => {
    if (!entry) {
      setLoading(false);
      return;
    }
    setLoading(true);
    entry.loader().then((md) => {
      setContent(md);
      setLoading(false);
    });
  }, [entry]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <span className="text-zinc-500 text-sm animate-pulse">Loading doc…</span>
      </div>
    );
  }

  if (!entry || !content) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <span className="text-zinc-400 text-lg">📄 Doc not found</span>
        <Link to="/docs/browse" className="text-tg-blue hover:underline text-sm">
          ← Back to all docs
        </Link>
      </div>
    );
  }

  // Find prev/next in the combined docs+guides list
  const allDocs = [...docs, ...guides];
  const idx = allDocs.findIndex((d) => d.slug === slug);
  const prev = idx > 0 ? allDocs[idx - 1] : undefined;
  const next = idx < allDocs.length - 1 ? allDocs[idx + 1] : undefined;

  return (
    <div className="relative">
      {/* Sticky breadcrumb */}
      <div className="sticky top-0 z-10 bg-tg-chat/95 backdrop-blur-sm border-b border-tg-border px-4 py-2">
        <div className="flex items-center gap-2 max-w-3xl mx-auto text-sm">
          <Link to="/docs" className="text-zinc-500 hover:text-tg-blue transition">Docs</Link>
          <span className="text-zinc-600">›</span>
          <Link to="/docs/browse" className="text-zinc-500 hover:text-tg-blue transition">Browse</Link>
          <span className="text-zinc-600">›</span>
          <span className="text-zinc-300 truncate">{entry.title}</span>
        </div>
      </div>

      <MarkdownChat markdown={content} title={entry.title} emoji="📄" />

      {/* Prev / Next navigation */}
      <div className="flex justify-between items-center max-w-3xl mx-auto px-4 pb-8">
        {prev ? (
          <Link to={`/docs/browse/${prev.slug}`} className="text-tg-blue hover:underline text-sm">
            ← {prev.title}
          </Link>
        ) : <span />}
        {next ? (
          <Link to={`/docs/browse/${next.slug}`} className="text-tg-blue hover:underline text-sm">
            {next.title} →
          </Link>
        ) : <span />}
      </div>
    </div>
  );
}
