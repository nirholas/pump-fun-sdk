/** Truncate a Solana address to "7xKp...3nRm" format */
export function WalletAddress({ address, chars = 4 }: { address: string; chars?: number }) {
  if (address.length <= chars * 2 + 3) return <span className="font-mono text-zinc-400">{address}</span>;
  const display = `${address.slice(0, chars)}...${address.slice(-chars)}`;
  return (
    <a
      href={`https://solscan.io/account/${address}`}
      target="_blank"
      rel="noopener noreferrer"
      className="font-mono text-zinc-400 hover:text-tg-blue transition"
      title={address}
    >
      {display}
    </a>
  );
}
