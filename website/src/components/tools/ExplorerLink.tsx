'use client';

export function ExplorerLink({ address }: { address: string }) {
  const explorers = [
    { name: 'Solscan', url: `https://solscan.io/account/${address}` },
    { name: 'Explorer', url: `https://explorer.solana.com/address/${address}` },
    { name: 'SolanaFM', url: `https://solana.fm/address/${address}` },
  ];

  return (
    <div className="flex items-center gap-1.5">
      {explorers.map((e) => (
        <a
          key={e.name}
          href={e.url}
          target="_blank"
          rel="noopener noreferrer"
          className="px-2 py-0.5 text-[10px] font-medium text-muted-foreground border border-border rounded hover:text-white hover:border-dark-600 transition-colors"
        >
          {e.name} ↗
        </a>
      ))}
    </div>
  );
}
