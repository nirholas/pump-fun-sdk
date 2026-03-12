import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { MarkdownChat } from '../components/MarkdownChat';
import { findTutorial, tutorials } from '../lib/content';

export function TutorialViewer() {
  const { slug } = useParams<{ slug: string }>();
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const entry = slug ? findTutorial(slug) : undefined;

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
        <span className="text-zinc-500 text-sm animate-pulse">Loading tutorial…</span>
      </div>
    );
  }

  if (!entry || !content) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <span className="text-zinc-400 text-lg">📚 Tutorial not found</span>
        <Link to="/tutorials" className="text-tg-blue hover:underline text-sm">
          ← Back to all tutorials
        </Link>
      </div>
    );
  }

  const idx = tutorials.findIndex((t) => t.slug === slug);
  const prev = idx > 0 ? tutorials[idx - 1] : undefined;
  const next = idx < tutorials.length - 1 ? tutorials[idx + 1] : undefined;

  return (
    <div className="relative">
      {/* Sticky breadcrumb */}
      <div className="sticky top-0 z-10 bg-tg-chat/95 backdrop-blur-sm border-b border-tg-border px-4 py-2">
        <div className="flex items-center gap-2 max-w-3xl mx-auto text-sm">
          <Link to="/docs" className="text-zinc-500 hover:text-tg-blue transition">Docs</Link>
          <span className="text-zinc-600">›</span>
          <Link to="/tutorials" className="text-zinc-500 hover:text-tg-blue transition">Tutorials</Link>
          <span className="text-zinc-600">›</span>
          <span className="text-zinc-300 truncate">{entry.title}</span>
        </div>
      </div>

      <MarkdownChat markdown={content} title={entry.title} emoji="📚" />

      {/* Prev / Next navigation */}
      <div className="flex justify-between items-center max-w-3xl mx-auto px-4 pb-8">
        {prev ? (
          <Link to={`/tutorials/${prev.slug}`} className="text-tg-blue hover:underline text-sm">
            ← {prev.title}
          </Link>
        ) : <span />}
        {next ? (
          <Link to={`/tutorials/${next.slug}`} className="text-tg-blue hover:underline text-sm">
            {next.title} →
          </Link>
        ) : <span />}
      </div>
    </div>
  );
}
