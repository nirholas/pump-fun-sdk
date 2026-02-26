'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { clsx } from 'clsx';
import { ThemeToggle } from './ThemeProvider';

const links = [
  { href: '/', label: 'Home' },
  { href: '/tools', label: 'Tools' },
  { href: '/docs', label: 'Docs' },
  { href: '/examples', label: 'Examples' },
  { href: '/mcp', label: 'MCP' },
];

export function Navigation() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <nav className="relative z-50 border-b border-border bg-black/80 backdrop-blur-md">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 group">
          <span className="text-lg font-semibold tracking-tight">
            <span className="text-solana">◎</span>{' '}
            <span className="text-white group-hover:text-gradient-solana transition-all">
              Pump Fun SDK
            </span>
          </span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden sm:flex items-center gap-1">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={clsx(
                'px-3 py-1.5 text-sm rounded transition-colors',
                pathname === link.href
                  ? 'text-white bg-dark-600'
                  : 'text-muted-foreground hover:text-white hover:bg-dark-700'
              )}
            >
              {link.label}
            </Link>
          ))}
          <a
            href="https://github.com/nirholas/pump-fun-sdk"
            target="_blank"
            rel="noopener noreferrer"
            className="ml-2 px-3 py-1.5 text-sm text-muted-foreground hover:text-white transition-colors"
          >
            GitHub
          </a>
          <ThemeToggle />
        </div>

        {/* Mobile menu button */}
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="sm:hidden p-2 text-muted-foreground hover:text-white"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            {menuOpen ? (
              <path d="M5 5L15 15M15 5L5 15" stroke="currentColor" strokeWidth="1.5" />
            ) : (
              <>
                <path d="M3 5H17" stroke="currentColor" strokeWidth="1.5" />
                <path d="M3 10H17" stroke="currentColor" strokeWidth="1.5" />
                <path d="M3 15H17" stroke="currentColor" strokeWidth="1.5" />
              </>
            )}
          </svg>
        </button>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="sm:hidden border-t border-border bg-black/95 backdrop-blur-md">
          <div className="px-4 py-3 space-y-1">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className={clsx(
                  'block px-3 py-2 text-sm rounded transition-colors',
                  pathname === link.href
                    ? 'text-white bg-dark-600'
                    : 'text-muted-foreground hover:text-white'
                )}
              >
                {link.label}
              </Link>
            ))}
            <a
              href="https://github.com/nirholas/pump-fun-sdk"
              target="_blank"
              rel="noopener noreferrer"
              className="block px-3 py-2 text-sm text-muted-foreground hover:text-white"
            >
              GitHub ↗
            </a>
          </div>
        </div>
      )}
    </nav>
  );
}

