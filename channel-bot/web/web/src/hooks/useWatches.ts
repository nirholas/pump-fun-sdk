import { useCallback, useEffect, useState } from 'react';
import { addWatch, fetchWatches, removeWatch } from '../lib/api';
import type { WatchResponse } from '../lib/types';

interface UseWatchesReturn {
  watches: WatchResponse[];
  loading: boolean;
  error: string | null;
  add: (address: string, label?: string) => Promise<void>;
  remove: (address: string) => Promise<void>;
  refresh: () => Promise<void>;
}

export function useWatches(): UseWatchesReturn {
  const [watches, setWatches] = useState<WatchResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setError(null);
      const data = await fetchWatches();
      setWatches(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fetch watches');
    } finally {
      setLoading(false);
    }
  }, []);

  const add = useCallback(async (address: string, label?: string) => {
    try {
      setError(null);
      const watch = await addWatch(address, label);
      setWatches((prev) => [...prev, watch]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add watch');
    }
  }, []);

  const remove = useCallback(async (address: string) => {
    try {
      setError(null);
      await removeWatch(address);
      setWatches((prev) => prev.filter((w) => w.wallet !== address));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to remove watch');
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { watches, loading, error, add, remove, refresh };
}
