import { useState } from 'react';
import { Link } from 'react-router-dom';
import { tutorials } from '../lib/content';

export function TutorialsList() {
  const [search, setSearch] = useState('');

  const filtered = search
    ? tutorials.filter((t) => t.title.toLowerCase().includes(search.toLowerCase()))
    : tutorials;

  return (
    <div className="relative">
      {/* Sticky header */}
      <div className="sticky top-0 z-10 bg-tg-chat/95 backdrop-blur-sm border-b border-tg-border px-4 py-2">
        <div className="flex items-center gap-3 max-w-3xl mx-auto">
          <Link to="/docs" className="text-zinc-500 hover:text-tg-blue transition text-sm">← Docs</Link>
          <input
            type="text"
            placeholder="Search tutorials…"
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
            📚 All Tutorials ({filtered.length})
          </span>
        </div>

        {/* Tutorials as individual chat bubbles - grouped by 10s */}
        {(() => {
          const groups: { label: string; items: typeof filtered }[] = [];
          for (let i = 0; i < filtered.length; i += 10) {
            const chunk = filtered.slice(i, i + 10);
            const start = i + 1;
            const end = Math.min(i + 10, filtered.length);
            groups.push({ label: `Tutorials ${start}–${end}`, items: chunk });
          }
          return groups.map((group) => (
            <div key={group.label} className="flex gap-2 items-start max-w-[85%] mr-auto">
              <div className="w-8 h-8 rounded-full bg-tg-input flex items-center justify-center text-sm shrink-0 mt-1">
                📚
              </div>
              <div className="bg-tg-bubble-in rounded-2xl rounded-bl-sm px-4 py-3 text-white flex-1 min-w-0">
                <p className="text-tg-blue text-sm font-medium mb-2">{group.label}</p>
                <ol className="space-y-1">
                  {group.items.map((tutorial) => {
                    const num = tutorial.slug.match(/^(\d+)/)?.[1] ?? '';
                    return (
                      <li key={tutorial.slug}>
                        <Link
                          to={`/tutorials/${tutorial.slug}`}
                          className="flex items-center gap-2 text-sm text-zinc-300 hover:text-tg-blue transition py-0.5"
                        >
                          <span className="text-zinc-500 font-mono text-xs w-6 text-right shrink-0">{num}.</span>
                          {tutorial.title}
                        </Link>
                      </li>
                    );
                  })}
                </ol>
              </div>
            </div>
          ));
        })()}
      </div>
    </div>
  );
}
