/** Connection status indicator dot: green, yellow, or red */
export function StatusDot({ status }: { status: 'connected' | 'connecting' | 'disconnected' }) {
  const colors = {
    connected: 'bg-pump-green',
    connecting: 'bg-pump-yellow animate-pulse',
    disconnected: 'bg-pump-pink',
  };
  const labels = {
    connected: 'Connected',
    connecting: 'Connecting...',
    disconnected: 'Disconnected',
  };
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-zinc-400">
      <span className={`w-2 h-2 rounded-full ${colors[status]}`} />
      {labels[status]}
    </span>
  );
}
