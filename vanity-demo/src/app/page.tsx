import Link from "next/link";

const cards = [
  {
    href: "/proof",
    num: "01",
    title: "On-chain proof",
    desc: "Live query of the Pump program — fetch real recent token launches and verify that pump.fun mints actually end in "pump". The on-chain program enforces nothing; it's all off-chain grinding.",
    cta: "View live mints →",
    color: "var(--accent)",
  },
  {
    href: "/grind",
    num: "02",
    title: "Browser grinder",
    desc: "Grind a Solana keypair whose address ends in any suffix you choose — right in your browser. Runs in a Web Worker with Web Crypto API. Zero server calls, zero network, keys never leave the tab.",
    cta: "Start grinding →",
    color: "var(--accent2)",
  },
  {
    href: "/create",
    num: "03",
    title: "Create a token",
    desc: "Connect Phantom/Backpack, grind a vanity mint ending in "pump", build the createV2 instruction with @nirholas/pump-sdk, sign with both your wallet and the mint keypair, and submit to devnet. Real transaction.",
    cta: "Connect & create →",
    color: "var(--green)",
  },
];

export default function Home() {
  return (
    <div>
      <div style={{ marginBottom: 48 }}>
        <h1 style={{ fontSize: 32, fontWeight: 700, color: "var(--fg)", letterSpacing: "-0.03em", lineHeight: 1.2, marginBottom: 12 }}>
          Vanity mints on Pump
        </h1>
        <p style={{ fontSize: 16, color: "var(--fg2)", maxWidth: 560, lineHeight: 1.7 }}>
          Every pump.fun token has a mint ending in <code style={code}>pump</code>. That suffix is cosmetic — the protocol doesn't require it. Pump.fun grinds keypairs until one matches before calling <code style={code}>createV2</code>. This demo shows you how to do the same thing from your own code.
        </p>
        <div style={{ marginTop: 20, display: "flex", gap: 8, flexWrap: "wrap" as const }}>
          <Chip>@nirholas/pump-sdk</Chip>
          <Chip>Web Crypto API</Chip>
          <Chip>Devnet</Chip>
          <Chip>Phantom / Backpack</Chip>
          <Chip>Real on-chain txs</Chip>
        </div>
      </div>

      <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}>
        {cards.map((c) => (
          <Link key={c.href} href={c.href} style={{ textDecoration: "none" }}>
            <div style={cardStyle}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
                <span style={{ fontSize: 11, color: "var(--fg4)", fontWeight: 600, letterSpacing: "0.08em" }}>
                  {c.num}
                </span>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: c.color, flexShrink: 0 }} />
              </div>
              <h2 style={{ fontSize: 16, fontWeight: 600, color: "var(--fg)", marginBottom: 10, letterSpacing: "-0.01em" }}>
                {c.title}
              </h2>
              <p style={{ fontSize: 13, color: "var(--fg3)", lineHeight: 1.65, marginBottom: 20 }}>
                {c.desc}
              </p>
              <span style={{ fontSize: 13, color: c.color, fontWeight: 500 }}>{c.cta}</span>
            </div>
          </Link>
        ))}
      </div>

      <div style={{ marginTop: 48, padding: "20px 24px", background: "var(--bg3)", border: "1px solid var(--border)", borderRadius: "var(--radius)" }}>
        <p style={{ fontSize: 13, color: "var(--fg3)", lineHeight: 1.7 }}>
          <strong style={{ color: "var(--fg2)" }}>How it works:</strong> The Pump on-chain program accepts any valid keypair as the mint — the mint account must be a signer on the <code style={code}>createV2</code> transaction, but its address is unconstrained. Pump.fun's frontend just happens to grind for a <code style={code}>...pump</code> suffix before submitting. You can do the same with <code style={code}>generateVanityMint({"{ suffix: \"pump\" }"})</code> from the SDK.
        </p>
      </div>
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span style={{
      background: "var(--bg3)",
      border: "1px solid var(--border)",
      borderRadius: 20,
      padding: "3px 10px",
      fontSize: 11,
      color: "var(--fg3)",
      fontWeight: 500,
      letterSpacing: "0.01em",
    }}>
      {children}
    </span>
  );
}

const code: React.CSSProperties = {
  fontFamily: "monospace",
  fontSize: "0.85em",
  background: "rgba(255,255,255,0.06)",
  padding: "1px 5px",
  borderRadius: 4,
  color: "var(--fg)",
};

const cardStyle: React.CSSProperties = {
  background: "var(--bg3)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius)",
  padding: "20px 24px",
  height: "100%",
  transition: "border-color 0.15s",
  cursor: "pointer",
};
