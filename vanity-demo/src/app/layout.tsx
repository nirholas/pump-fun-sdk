import type { Metadata } from "next";
import Link from "next/link";
import { WalletProvider } from "@/components/WalletProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pump Vanity Demo",
  description:
    "Live demo: generate vanity pump mints in the browser, prove the suffix is cosmetic, create real tokens on devnet.",
};

const NAV_LINKS = [
  { href: "/proof", label: "On-chain proof" },
  { href: "/grind", label: "Grind" },
  { href: "/create", label: "Create token" },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <WalletProvider>
          <header style={styles.header}>
            <Link href="/" style={styles.brand}>
              <span style={{ color: "var(--fg)", fontWeight: 600 }}>pump</span>
              <span style={{ color: "var(--accent)", fontWeight: 600 }}>vanity</span>
              <span style={{ color: "var(--fg3)", fontSize: 12, marginLeft: 8 }}>demo</span>
            </Link>
            <nav style={styles.nav}>
              {NAV_LINKS.map(({ href, label }) => (
                <Link key={href} href={href} style={styles.navLink}>
                  {label}
                </Link>
              ))}
              <a
                href="https://github.com/nirholas/pump-fun-sdk"
                target="_blank"
                rel="noopener noreferrer"
                style={{ ...styles.navLink, color: "var(--fg4)" }}
              >
                GitHub ↗
              </a>
            </nav>
          </header>
          <main style={{ maxWidth: 860, margin: "0 auto", padding: "40px 20px 80px" }}>
            {children}
          </main>
        </WalletProvider>
      </body>
    </html>
  );
}

const styles = {
  header: {
    borderBottom: "1px solid var(--border)",
    padding: "0 24px",
    height: 52,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    position: "sticky" as const,
    top: 0,
    background: "rgba(9,9,11,0.9)",
    backdropFilter: "blur(12px)",
    zIndex: 100,
  },
  brand: {
    display: "flex",
    alignItems: "baseline",
    gap: 2,
    fontSize: 16,
    letterSpacing: "-0.02em",
  },
  nav: {
    display: "flex",
    alignItems: "center",
    gap: 24,
  },
  navLink: {
    color: "var(--fg3)",
    fontSize: 13,
    transition: "color 0.15s",
  },
} as const;
