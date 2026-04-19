"use client";

import { useEffect, useRef, useState } from "react";

const BASE58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

interface GrindResult {
  publicKey: string;
  secretKey: number[];
  attempts: number;
  durationMs: number;
}

interface GrindState {
  phase: "idle" | "grinding" | "done" | "error";
  attempts: number;
  rate: number;
  result: GrindResult | null;
  error: string | null;
}

function isValidB58(s: string) {
  return s.split("").every((c) => BASE58.includes(c));
}

function estimateAttempts(suffix: string, prefix: string) {
  const len = suffix.length + prefix.length;
  return len === 0 ? 0 : Math.pow(58, len);
}

function fmtTime(attempts: number, rate: number): string {
  if (rate <= 0 || attempts <= 0) return "—";
  const secs = attempts / rate;
  if (secs < 1) return "<1s";
  if (secs < 60) return `~${Math.round(secs)}s`;
  if (secs < 3600) return `~${Math.round(secs / 60)}m`;
  if (secs < 86400) return `~${Math.round(secs / 3600)}h`;
  return `~${Math.round(secs / 86400)} days`;
}

function saveKeypair(result: GrindResult) {
  const secretKeyArray = result.secretKey;
  const blob = new Blob([JSON.stringify(secretKeyArray)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${result.publicKey}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function GrindPage() {
  const [suffix, setSuffix] = useState("pump");
  const [prefix, setPrefix] = useState("");
  const [caseInsensitive, setCaseInsensitive] = useState(false);
  const [state, setState] = useState<GrindState>({ phase: "idle", attempts: 0, rate: 0, result: null, error: null });
  const [workerCount, setWorkerCount] = useState(2);
  const workersRef = useRef<Worker[]>([]);
  const doneRef = useRef(false);
  const startTimeRef = useRef(0);
  const attemptsRef = useRef<number[]>([]);

  const suffixErr = suffix && !isValidB58(suffix) ? "Contains characters not in Base58 (avoid 0, O, I, l)" : null;
  const prefixErr = prefix && !isValidB58(prefix) ? "Contains characters not in Base58 (avoid 0, O, I, l)" : null;
  const est = estimateAttempts(suffix, prefix);

  function stopWorkers() {
    workersRef.current.forEach((w) => w.terminate());
    workersRef.current = [];
    doneRef.current = false;
    attemptsRef.current = [];
  }

  useEffect(() => () => stopWorkers(), []);

  function start() {
    if (suffixErr || prefixErr) return;
    if (!suffix && !prefix) return;

    stopWorkers();
    doneRef.current = false;
    attemptsRef.current = Array(workerCount).fill(0);
    startTimeRef.current = Date.now();
    setState({ phase: "grinding", attempts: 0, rate: 0, result: null, error: null });

    const workers: Worker[] = [];
    for (let i = 0; i < workerCount; i++) {
      const w = new Worker("/grind.worker.js");
      workers.push(w);

      w.onmessage = (e: MessageEvent) => {
        const msg = e.data as { type: string; workerId: number; attempts?: number; rate?: number } & Partial<GrindResult>;

        if (msg.type === "progress") {
          if (msg.attempts !== undefined) attemptsRef.current[msg.workerId] = msg.attempts;
          const total = attemptsRef.current.reduce((a, b) => a + b, 0);
          const elapsed = (Date.now() - startTimeRef.current) / 1000;
          const aggRate = elapsed > 0 ? Math.round(total / elapsed) : 0;
          setState((s) => ({ ...s, attempts: total, rate: aggRate }));
        }

        if (msg.type === "found" && !doneRef.current) {
          doneRef.current = true;
          stopWorkers();
          if (msg.attempts !== undefined) attemptsRef.current[msg.workerId] = msg.attempts;
          const total = attemptsRef.current.reduce((a, b) => a + b, 0);
          const elapsed = (Date.now() - startTimeRef.current) / 1000;
          setState({
            phase: "done",
            attempts: total,
            rate: elapsed > 0 ? Math.round(total / elapsed) : 0,
            result: {
              publicKey: msg.publicKey!,
              secretKey: msg.secretKey!,
              attempts: total,
              durationMs: Date.now() - startTimeRef.current,
            },
            error: null,
          });
        }

        if (msg.type === "error") {
          stopWorkers();
          setState((s) => ({ ...s, phase: "error", error: String((msg as { error?: unknown }).error) }));
        }
      };

      w.postMessage({ type: "start", suffix, prefix, caseInsensitive, workerId: i });
    }
    workersRef.current = workers;
  }

  function stop() {
    stopWorkers();
    setState((s) => ({ ...s, phase: "idle" }));
  }

  const isRunning = state.phase === "grinding";

  return (
    <div>
      <div style={{ marginBottom: 32 }}>
        <h1 style={heading}>Browser grinder</h1>
        <p style={sub}>
          Grind a Solana keypair matching your desired prefix/suffix — entirely in your browser via Web
          Worker + Web Crypto API. Keys never leave the tab. Download the keypair JSON and pass it to
          <code style={code}> createV2Instruction</code> on the Create page.
        </p>
      </div>

      <div style={panel}>
        <h2 style={panelTitle}>Pattern</h2>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" as const, marginBottom: 16 }}>
          <Field label="Suffix (e.g. pump)" error={suffixErr}>
            <input
              style={{ ...input, borderColor: suffixErr ? "var(--red)" : "var(--border)" }}
              value={suffix}
              onChange={(e) => setSuffix(e.target.value)}
              placeholder="pump"
              disabled={isRunning}
              spellCheck={false}
            />
          </Field>
          <Field label="Prefix (optional)" error={prefixErr}>
            <input
              style={{ ...input, borderColor: prefixErr ? "var(--red)" : "var(--border)" }}
              value={prefix}
              onChange={(e) => setPrefix(e.target.value)}
              placeholder=""
              disabled={isRunning}
              spellCheck={false}
            />
          </Field>
          <Field label="Workers">
            <select
              style={{ ...input, cursor: "pointer" }}
              value={workerCount}
              onChange={(e) => setWorkerCount(Number(e.target.value))}
              disabled={isRunning}
            >
              {[1, 2, 4, 8].map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </Field>
        </div>

        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--fg3)", marginBottom: 20, cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={caseInsensitive}
            onChange={(e) => setCaseInsensitive(e.target.checked)}
            disabled={isRunning}
          />
          Case-insensitive (reduces difficulty ~3×)
        </label>

        {est > 0 && (
          <div style={{ fontSize: 13, color: "var(--fg3)", marginBottom: 20 }}>
            Expected: ~{est.toLocaleString()} attempts
            {state.rate > 0 && ` · ${fmtTime(est, state.rate * workerCount)}`}
          </div>
        )}

        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={start} style={{ ...primaryBtn, opacity: (suffixErr || prefixErr || (!suffix && !prefix)) ? 0.5 : 1 }} disabled={isRunning || !!suffixErr || !!prefixErr}>
            {isRunning ? "Grinding…" : "Start"}
          </button>
          {isRunning && (
            <button onClick={stop} style={secondaryBtn}>Stop</button>
          )}
        </div>
      </div>

      {isRunning && (
        <div style={panel}>
          <h2 style={panelTitle}>Progress</h2>
          <div style={{ display: "flex", gap: 24, flexWrap: "wrap" as const }}>
            <Metric label="Attempts" value={state.attempts.toLocaleString()} />
            <Metric label="Rate" value={`${state.rate.toLocaleString()}/s`} />
            <Metric label="Progress" value={est > 0 ? `${Math.min(99, Math.round((state.attempts / est) * 100))}%` : "—"} />
            <Metric label="Est. remaining" value={fmtTime(Math.max(0, est - state.attempts), state.rate)} />
          </div>
          <div style={{ marginTop: 16, height: 4, background: "var(--border)", borderRadius: 2, overflow: "hidden" }}>
            <div style={{
              height: "100%",
              background: "var(--accent)",
              borderRadius: 2,
              width: `${est > 0 ? Math.min(100, (state.attempts / est) * 100) : 0}%`,
              transition: "width 0.5s",
            }} />
          </div>
        </div>
      )}

      {state.phase === "done" && state.result && (
        <div style={panel}>
          <h2 style={{ ...panelTitle, color: "var(--green)" }}>✓ Found</h2>
          <div style={{ fontFamily: "monospace", fontSize: 13, color: "var(--fg)", wordBreak: "break-all", marginBottom: 16, padding: "12px 16px", background: "rgba(0,0,0,0.3)", borderRadius: 6, border: "1px solid var(--border)" }}>
            {(() => {
              const addr = state.result.publicKey;
              const sfx = suffix && addr.toLowerCase().endsWith(suffix.toLowerCase()) ? suffix.length : 0;
              const pfx = prefix && addr.toLowerCase().startsWith(prefix.toLowerCase()) ? prefix.length : 0;
              return (
                <>
                  <span style={{ color: "var(--accent2)" }}>{addr.slice(0, pfx)}</span>
                  <span style={{ color: "var(--fg2)" }}>{addr.slice(pfx, addr.length - sfx)}</span>
                  <span style={{ color: "var(--accent)", fontWeight: 700 }}>{addr.slice(addr.length - sfx)}</span>
                </>
              );
            })()}
          </div>
          <div style={{ display: "flex", gap: 24, flexWrap: "wrap" as const, marginBottom: 20 }}>
            <Metric label="Attempts" value={state.result.attempts.toLocaleString()} />
            <Metric label="Duration" value={`${(state.result.durationMs / 1000).toFixed(1)}s`} />
            <Metric label="Rate" value={`${state.rate.toLocaleString()}/s`} />
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" as const }}>
            <button onClick={() => saveKeypair(state.result!)} style={primaryBtn}>
              Download keypair JSON
            </button>
            <button
              onClick={() => {
                if (state.result) {
                  const url = new URL("/create", window.location.origin);
                  url.searchParams.set("pubkey", state.result.publicKey);
                  localStorage.setItem("vanity_keypair", JSON.stringify(state.result.secretKey));
                  window.location.href = url.toString();
                }
              }}
              style={secondaryBtn}
            >
              Use on Create page →
            </button>
          </div>
          <p style={{ marginTop: 12, fontSize: 12, color: "var(--fg4)" }}>
            Keep this keypair safe. Store the downloaded JSON with file permissions 0600. Never share your secret key.
          </p>
        </div>
      )}

      {state.phase === "error" && (
        <div style={{ ...panel, borderColor: "rgba(248,113,113,0.3)" }}>
          <p style={{ color: "var(--red)", fontSize: 13 }}>Error: {state.error}</p>
          <p style={{ fontSize: 12, color: "var(--fg4)", marginTop: 8 }}>
            Web Crypto Ed25519 may not be supported in this browser. Try Chrome 116+ or Firefox 117+.
          </p>
        </div>
      )}
    </div>
  );
}

function Field({ label, error, children }: { label: string; error?: string | null; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: "block", fontSize: 11, color: "var(--fg4)", marginBottom: 6, fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase" as const }}>{label}</label>
      {children}
      {error && <p style={{ fontSize: 11, color: "var(--red)", marginTop: 4 }}>{error}</p>}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: "var(--fg4)", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase" as const, marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: "var(--fg)", letterSpacing: "-0.02em" }}>{value}</div>
    </div>
  );
}

const heading: React.CSSProperties = { fontSize: 24, fontWeight: 700, color: "var(--fg)", letterSpacing: "-0.02em", marginBottom: 10 };
const sub: React.CSSProperties = { fontSize: 14, color: "var(--fg3)", lineHeight: 1.7, maxWidth: 580 };
const code: React.CSSProperties = { fontFamily: "monospace", fontSize: "0.85em", background: "rgba(255,255,255,0.06)", padding: "1px 5px", borderRadius: 4, color: "var(--fg)" };
const panel: React.CSSProperties = { background: "var(--bg3)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "20px 24px", marginBottom: 12 };
const panelTitle: React.CSSProperties = { fontSize: 13, fontWeight: 600, color: "var(--fg2)", marginBottom: 16 };
const input: React.CSSProperties = { background: "rgba(0,0,0,0.3)", border: "1px solid var(--border)", borderRadius: 6, color: "var(--fg)", fontSize: 13, padding: "7px 12px", fontFamily: "monospace", outline: "none", width: 180 };
const primaryBtn: React.CSSProperties = { background: "var(--fg)", color: "#09090b", border: "none", borderRadius: 6, padding: "8px 20px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" };
const secondaryBtn: React.CSSProperties = { background: "var(--bg3)", border: "1px solid var(--border)", color: "var(--fg2)", borderRadius: 6, padding: "8px 20px", fontSize: 13, cursor: "pointer", fontFamily: "inherit" };
