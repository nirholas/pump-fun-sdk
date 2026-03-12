import { useCallback, useEffect, useState } from 'react';
import { fetchHealth } from '../lib/api';
import type { HealthResponse } from '../lib/types';

interface UseHealthReturn {
  health: HealthResponse | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useHealth(pollIntervalMs = 15_000): UseHealthReturn {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setError(null);
      const data = await fetchHealth();
      setHealth(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Health check failed');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const id = setInterval(() => void refresh(), pollIntervalMs);
    return () => clearInterval(id);
  }, [refresh, pollIntervalMs]);

  return { health, loading, error, refresh };
}
