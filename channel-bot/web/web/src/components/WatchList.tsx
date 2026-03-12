import type { WatchResponse } from '../lib/types';

interface WatchListProps {
  watches: WatchResponse[];
  loading: boolean;
  onRemove: (address: string) => Promise<void>;
}

export function WatchList({ watches, loading, onRemove }: WatchListProps) {
  if (loading) {
    return <p className="text-xs text-zinc-500 px-3 py-2">Loading watches...</p>;
  }

  if (watches.length === 0) {
    return <p className="text-xs text-zinc-500 px-3 py-2">No watched wallets. Add one above.</p>;
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {watches.map((w) => (
        <div
          key={w.id}
          className="flex items-center gap-2 px-3 py-2 hover:bg-tg-hover transition group"
        >
          <div className={`w-2 h-2 rounded-full shrink-0 ${w.active ? 'bg-pump-green' : 'bg-zinc-600'}`} />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-zinc-200 truncate">{w.label || w.wallet}</p>
            {w.label && (
              <p className="text-[11px] text-zinc-500 font-mono truncate">{w.wallet}</p>
            )}
          </div>
          <button
            onClick={() => void onRemove(w.wallet)}
            className="text-zinc-600 hover:text-pump-pink text-xs opacity-0 group-hover:opacity-100 transition"
            title="Remove watch"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
