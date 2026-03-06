#!/usr/bin/env node
/**
 * Screenshot sectbot.com/app pages using Playwright
 * Usage: npx playwright install chromium --with-deps && node scripts/screenshot-sectbot.mjs
 */

import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
import { join } from 'path';

const OUTPUT_DIR = join(process.cwd(), 'screenshots', 'sectbot');
mkdirSync(OUTPUT_DIR, { recursive: true });

const PAGES = [
  { name: 'app-main', url: 'https://sectbot.com/app' },
  { name: 'dapp', url: 'https://sectbot.com/dapp' },
  { name: 'contest', url: 'https://sectbot.com/contest' },
  { name: 'staking', url: 'https://sectbot.com/staking' },
  { name: 'homepage', url: 'https://sectbot.com/' },
];

async function run() {
  console.log('Launching browser...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  });

  for (const page of PAGES) {
    console.log(`Capturing ${page.name} → ${page.url}`);
    const tab = await context.newPage();
    try {
      await tab.goto(page.url, { waitUntil: 'networkidle', timeout: 30000 });
      // Wait a bit for dynamic content
      await tab.waitForTimeout(3000);

      // Full page screenshot
      const filepath = join(OUTPUT_DIR, `${page.name}.png`);
      await tab.screenshot({ path: filepath, fullPage: true });
      console.log(`  ✓ Saved ${filepath}`);

      // Also capture viewport-only
      const vpPath = join(OUTPUT_DIR, `${page.name}-viewport.png`);
      await tab.screenshot({ path: vpPath, fullPage: false });
      console.log(`  ✓ Saved ${vpPath}`);
    } catch (err) {
      console.error(`  ✗ Failed ${page.name}: ${err.message}`);
    } finally {
      await tab.close();
    }
  }

  await browser.close();
  console.log(`\nDone! Screenshots saved to ${OUTPUT_DIR}`);
}

run().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
