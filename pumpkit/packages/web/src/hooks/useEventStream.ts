import { useEffect, useRef, useState } from 'react';
import type { BaseEvent } from '../lib/types';

const MAX_EVENTS = 200;

/**
 * Connects to the monitor bot SSE stream and returns a list of events.
 * Auto-reconnects on disconnection with exponential backoff.
 */
export function useEventStream(): BaseEvent[] {
  const [events, setEvents] = useState<BaseEvent[]>([]);
  const retryDelay = useRef(1000);

  useEffect(() => {
    let eventSource: EventSource | null = null;
    let mounted = true;

    function connect() {
      const baseUrl = import.meta.env.VITE_API_URL || '';
      eventSource = new EventSource(`${baseUrl}/api/v1/claims/stream`);

      eventSource.onopen = () => {
        retryDelay.current = 1000;
      };

      eventSource.onmessage = (msg) => {
        if (!mounted) return;
        try {
          const event = JSON.parse(msg.data) as BaseEvent;
          setEvents((prev) => [event, ...prev].slice(0, MAX_EVENTS));
        } catch {
          // skip malformed messages
        }
      };

      eventSource.onerror = () => {
        eventSource?.close();
        if (!mounted) return;
        setTimeout(connect, retryDelay.current);
        retryDelay.current = Math.min(retryDelay.current * 2, 30_000);
      };
    }

    connect();

    return () => {
      mounted = false;
      eventSource?.close();
    };
  }, []);

  return events;
}
