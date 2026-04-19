"use client";

import { useEffect, useState } from "react";
import type { RecentMint } from "@/lib/pump";

type State =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "done"; mints: RecentMint[] }
  | { status: "error"; error: string };

function timeSince(epoch: number): string {
  const diff = Math.floor(Date.now() / 1000) - epoch;
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

function MintRow({ mint }: { mint: RecentMint }) {
  const addr = mint.mint;
  const suffix = mint.endsWithPump ? addr.slice(-4) : null;
  const prefix = suffix ? addr.slice(0, -4) : addr;

  return (
    <div style={row}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
        <span style={{
          width: 7, height: 7, borderRadius: "50%", flexShrink: 0,
          background: mint.endsWithPump ? "var(--green)" : "var(--fg4)",
        }} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: "monospace", fontSize: 12, color: "var(--fg2)", wordBreak: "break-all" }}>
            {prefix}
            {suffix && (
              <span style={{ color: "var(--accent)", fontWeight: 700 }}>{suffix}</span>
            )}
          </div>
          <div style={{ fontSize: 12, color: "var(--fg3)", marginTop: 2 }}>
            <span style={{ color: "var(--fg)" }}>{mint.symbol}</span>
            {" · "}{mint.name}
            {" · "}<span style={{ fontFamily: "monospace", fontSize: 11 }}>{mint.creator.slice(0, 6)}…{mint.creator.slice(-4)}</span>
          </div>
        </div>
      </div>
      <div style={{ textAlign: "right" as const, flexShrink: 0, marginLeft: 12 }}>
        <div style={{ fontSize: 11, color: mint.endsWithPump ? "var(--green)" : "var(--fg4)", fontWeight: 600 }}>
          {mint.endsWithPump ? "✓ ends pump" : "no suffix"}
        </div>
        <div style={{ fontSize: 11, color: "var(--fg4)", marginTop: 2 }}>
          {timeSince(mint.blockTime)}
        </div>
        <a
          href={`https://solscan.io/tx/${mint.signature}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{ fontSize: 11, color: "var(--accent2)" }}
        >
          tx ↗
        </a>
      </div>
    </div>
  );
}

export default function ProofPage() {
  const [state, setState] = useState<State>({ status: "idle" });
  const [pumpCount, setPumpCount] = useState(0);
  const [total, setTotal] = useState(0);

  async function load() {
    setState({ status: "loading" });
    try {
      const res = await fetch("/api/recent-mints");
      const data = await res.json() as { mints?: RecentMint[]; error?: string };
      if (data.error) throw new Error(data.error);
      const mints = data.mints ?? [];
      setPumpCount(mints.filter((m) => m.endsWithPump).length);
      setTotal(mints.length);
      setState({ status: "done", mints });
    } catch (err) {
      setState({ status: "error", error: err instanceof Error ? err.message : "Unknown error" });
    }
  }

  useEffect(() => { void load(); }, []);

  return (
    <div>
      <div style={{ marginBottom: 32 }}>
        <h1 style={heading}>On-chain proof</h1>
        <p style={sub}>
          Live query of <code style={code}>PUMP_PROGRAM_ID</code> on mainnet. We fetch recent signatures,
          decode <code style={code}>CreateEvent</code> logs from each transaction, and check whether the
          mint address ends in <code style={code}>pump</code>. No mocks, no stubs — real RPC data.
        </p>
      </div>

      {state.status === "done" && total > 0 && (
        <div style={statsRow}>
          <Stat label="Tokens fetched" value={String(total)} />
          <Stat label="Ends in &#34;pump&#34;" value={String(pumpCount)} color="var(--green)" />
          <Stat label="Percentage" value={`${Math.round((pumpCount / total) * 100)}%`} color="var(--accent)" />
          <Stat label="Enforced on-chain?" value="No" color="var(--red)" />
        </div>
      )}

      <div style={{ marginBottom: 16, display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ fontSize: 13, color: "var(--fg3)", fontWeight: 500 }}>Recent Pump tokens (mainnet)</span>
        <button onClick={load} style={btn} disabled={state.status === "loading"}>
          {state.status === "loading" ? "Loading…" : "Refresh"}
        </button>
      </div>

      {state.status === "loading" && (
        <div style={placeholder}>Querying mainnet RPC…</div>
      )}
      {state.status === "error" && (
        <div style={{ ...placeholder, color: "var(--red)" }}>
          Error: {state.error}
        </div>
      )}
      {state.status === "done" && (
        <div style={list}>
          {state.mints.length === 0 ? (
            <div style={placeholder}>No create transactions found in recent history.</div>
          ) : (
            state.mints.map((m) => <MintRow key={m.signature} mint={m} />)
          )}
        </div>
      )}

      <div style={{ marginTop: 32, padding: "16px 20px", background: "var(--bg3)", border: "1px solid var(--border)", borderRadius: "var(--radius)" }}>
        <p style={{ fontSize: 13, color: "var(--fg3)", lineHeight: 1.7 }}>
          <strong style={{ color: "var(--fg2)" }}>Why does this work?</strong>  The <code style={code}>mint</code> account
          in <code style={code}>createV2</code> is declared as a plain keypair signer in the IDL (no PDA seeds). The on-chain program
          accepts any 32-byte pubkey — it never inspects the last 4 characters. Pump.fun's website just grinds
          off-chain until the address ends in <code style={code}>pump</code> before calling <code style={code}>createV2</code>.
          You can replicate this with <code style={code}>generateVanityMint({"{ suffix: \"pump\" }"})</code> from the SDK.
        </p>
      </div>
    </div>
  );
}

function Stat({ label, value, color = "var(--fg)" }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ background: "var(--bg3)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "14px 20px", flex: 1, minWidth: 120 }}>
      <div style={{ fontSize: 11, color: "var(--fg4)", marginBottom: 4, fontWeight: 500, letterSpacing: "0.05em", textTransform: "uppercase" as const }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color, letterSpacing: "-0.02em" }}>{value}</div>
    </div>
  );
}

const heading: React.CSSProperties = { fontSize: 24, fontWeight: 700, color: "var(--fg)", letterSpacing: "-0.02em", marginBottom: 10 };
const sub: React.CSSProperties = { fontSize: 14, color: "var(--fg3)", lineHeight: 1.7, maxWidth: 580 };
const code: React.CSSProperties = { fontFamily: "monospace", fontSize: "0.85em", background: "rgba(255,255,255,0.06)", padding: "1px 5px", borderRadius: 4, color: "var(--fg)" };
const statsRow: React.CSSProperties = { display: "flex", gap: 10, marginBottom: 24, flexWrap: "wrap" as const };
const list: React.CSSProperties = { border: "1px solid var(--border)", borderRadius: "var(--radius)", overflow: "hidden" };
const row: React.CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", borderBottom: "1px solid var(--border)", background: "var(--bg2)" };
const placeholder: React.CSSProperties = { padding: 32, textAlign: "center" as const, color: "var(--fg4)", fontSize: 13 };
const btn: React.CSSProperties = { background: "var(--bg3)", border: "1px solid var(--border)", color: "var(--fg2)", padding: "5px 14px", borderRadius: 6, fontSize: 12, cursor: "pointer", fontFamily: "inherit" };
