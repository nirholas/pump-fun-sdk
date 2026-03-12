import { useState } from 'react';

interface WatchFormProps {
  onAdd: (address: string, label?: string) => Promise<void>;
}

export function WatchForm({ onAdd }: WatchFormProps) {
  const [address, setAddress] = useState('');
  const [label, setLabel] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = address.trim();
    if (!trimmed) return;
    setSubmitting(true);
    try {
      await onAdd(trimmed, label.trim() || undefined);
      setAddress('');
      setLabel('');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="px-3 py-2 border-b border-tg-border space-y-2">
      <input
        type="text"
        value={address}
        onChange={(e) => setAddress(e.target.value)}
        placeholder="Wallet address..."
        className="w-full bg-tg-input text-sm text-zinc-300 placeholder-zinc-500 rounded-lg px-3 py-1.5 outline-none focus:ring-1 focus:ring-tg-blue/40"
      />
      <div className="flex gap-2">
        <input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Label (optional)"
          className="flex-1 bg-tg-input text-sm text-zinc-300 placeholder-zinc-500 rounded-lg px-3 py-1.5 outline-none focus:ring-1 focus:ring-tg-blue/40"
        />
        <button
          type="submit"
          disabled={!address.trim() || submitting}
          className="bg-tg-blue text-white text-xs rounded-lg px-3 py-1.5 hover:bg-tg-blue/80 transition disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {submitting ? '...' : '+ Add'}
        </button>
      </div>
    </form>
  );
}
