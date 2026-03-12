import { useState } from 'react';
import { Link } from 'react-router-dom';
import { docs, guides } from '../lib/content';

export function DocsList() {
  const [search, setSearch] = useState('');
  const allDocs = [...docs, ...guides];

  const filtered = search
    ? allDocs.filter((d) => d.title.toLowerCase().includes(search.toLowerCase()))
    : allDocs;

  return (
    <div className="relative">
      {/* Sticky header */}
      <div className="sticky top-0 z-10 bg-tg-chat/95 backdrop-blur-sm border-b border-tg-border px-4 py-2">
        <div className="flex items-center gap-3 max-w-3xl mx-auto">
          <Link to="/docs" className="text-zinc-500 hover:text-tg-blue transition text-sm">← Docs</Link>
          <input
            type="text"
            placeholder="Search docs…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-tg-input text-sm text-zinc-300 placeholder-zinc-500 rounded-full px-4 py-1.5 outline-none focus:ring-1 focus:ring-tg-blue/40 transition"
          />
        </div>
      </div>

      <div className="flex flex-col gap-3 p-4 max-w-3xl mx-auto pb-20 bubble-stagger">
        {/* Date separator */}
        <div className="text-center">
          <span className="bg-tg-input/80 text-zinc-400 text-xs px-3 py-1 rounded-full">
            📄 All Documentation ({filtered.length})
          </span>
        </div>

        {/* Guides section */}
        {guides.length > 0 && (
          <div className="flex gap-2 items-start max-w-[85%] mr-auto">
            <div className="w-8 h-8 rounded-full bg-tg-input flex items-center justify-center text-sm shrink-0 mt-1">
              🧭
            </div>
            <div className="bg-tg-bubble-in rounded-2xl rounded-bl-sm px-4 py-3 text-white flex-1 min-w-0">
              <p className="text-tg-blue text-sm font-medium mb-2">Guides</p>
              <div className="space-y-1">
                {guides
                  .filter((g) => !search || g.title.toLowerCase().includes(search.toLowerCase()))
                  .map((guide) => (
                    <Link
                      key={guide.slug}
                      to={`/docs/browse/${guide.slug}`}
                      className="flex items-center gap-2 text-sm text-zinc-300 hover:text-tg-blue transition py-0.5"
                    >
                      <span className="text-zinc-500">📘</span>
                      {guide.title}
                    </Link>
                  ))}
              </div>
            </div>
          </div>
        )}

        {/* Reference docs section */}
        <div className="flex gap-2 items-start max-w-[85%] mr-auto">
          <div className="w-8 h-8 rounded-full bg-tg-input flex items-center justify-center text-sm shrink-0 mt-1">
            📖
          </div>
          <div className="bg-tg-bubble-in rounded-2xl rounded-bl-sm px-4 py-3 text-white flex-1 min-w-0">
            <p className="text-tg-blue text-sm font-medium mb-2">Reference Docs</p>
            <div className="space-y-1">
              {docs
                .filter((d) => !search || d.title.toLowerCase().includes(search.toLowerCase()))
                .map((doc) => (
                  <Link
                    key={doc.slug}
                    to={`/docs/browse/${doc.slug}`}
                    className="flex items-center gap-2 text-sm text-zinc-300 hover:text-tg-blue transition py-0.5"
                  >
                    <span className="text-zinc-500">📄</span>
                    {doc.title}
                  </Link>
                ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
