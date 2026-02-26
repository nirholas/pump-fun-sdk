export function Footer() {
  return (
    <footer className="relative z-10 border-t border-border bg-black/80">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-sm text-muted-foreground">
            <span className="text-solana">◎</span> Pump Fun SDK — Official Solana token launchpad SDK powered by{' '}
            <a
              href="https://github.com/solana-labs"
              target="_blank"
              rel="noopener noreferrer"
              className="text-white hover:text-solana transition-colors"
            >
              Solana Labs
            </a>{' '}
            libraries
          </div>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <a
              href="https://github.com/nirholas/pump-fun-sdk"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white transition-colors"
            >
              GitHub
            </a>
            <span className="text-border">|</span>
            <span>MIT License</span>
            <span className="text-border">|</span>
            <a
              href="https://x.com/paboracle"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white transition-colors"
            >
              @paboracle
            </a>
          </div>
        </div>
        <div className="mt-4 pt-4 border-t border-border text-center">
          <p className="text-xs text-muted">
            Community SDK for the Pump protocol on Solana. Create, buy, sell, and migrate tokens
            with bonding curve pricing. Use at your own risk.
          </p>
        </div>
      </div>
    </footer>
  );
}
