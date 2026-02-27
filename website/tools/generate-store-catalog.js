#!/usr/bin/env node
// packages/os/tools/generate-store-catalog.js
//
// Scans all app HTML files in Pump-Store/apps/ and appdata/ and
// auto-generates the Pump-Store/db/v2.json store catalog.
//
// Usage:  cd packages/os && node tools/generate-store-catalog.js
// Or:     pnpm catalog:os   (from repo root)
//
// Uses only Node.js built-ins — no external dependencies.

const fs = require('fs');
const path = require('path');

// ── Directories ──────────────────────────────────────────────────────────────
const OS_ROOT = path.resolve(__dirname, '..');
const STORE_APPS_DIR = path.join(OS_ROOT, 'Pump-Store', 'apps');
const APPDATA_DIR = path.join(OS_ROOT, 'appdata');
const OUTPUT_FILE = path.join(OS_ROOT, 'Pump-Store', 'db', 'v2.json');

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Extract content of a <meta name="X" content="Y"> tag.
 * Handles both single and double quotes, and multi-line SVG icons.
 */
function getMeta(html, name) {
    // Match meta tags with the given name — content can use ' or "
    // For lair-icon we need a more permissive pattern because SVG content contains quotes
    if (name === 'lair-icon') {
        // Try content='...' first (common for SVG icons with double quotes inside)
        const singleQuoteRe = new RegExp(
            `<meta\\s+name=["']${name}["']\\s+content='([^']*(?:''[^']*)*)'`,
            'is'
        );
        let m = html.match(singleQuoteRe);
        if (m) return m[1].trim();

        // Try content="..." (works if SVG uses single quotes)
        const doubleQuoteRe = new RegExp(
            `<meta\\s+name=["']${name}["']\\s+content="([^"]*)"`,
            'is'
        );
        m = html.match(doubleQuoteRe);
        if (m) return m[1].trim();

        return null;
    }

    const re = new RegExp(
        `<meta\\s+name=["']${name}["']\\s+content=["']([^"']*)["']`,
        'i'
    );
    const m = html.match(re);
    return m ? m[1].trim() : null;
}

/**
 * Extract the <title>...</title> text.
 */
function getTitle(html) {
    const m = html.match(/<title>([^<]+)<\/title>/i);
    return m ? m[1].trim() : null;
}

/**
 * Infer a store category from filename and content when no explicit meta tag is present.
 */
function inferCategory(filename, content) {
    const f = filename.toLowerCase();

    // Widget detection takes priority
    if (f.includes('widget-') || f.includes('widget.')) return 'widgets';

    // Trading / Charts
    if (f.includes('swap') || f.includes('dex') || f.includes('chart') || f.includes('trading') ||
        f.includes('orderbook') || f.includes('multichart') || f.includes('tradingview') ||
        f.includes('position') || f.includes('pnl') || f.includes('journal') ||
        f.includes('coingecko') || f.includes('coinglass') || f.includes('ticker') ||
        f.includes('price')) return 'trading';

    // DeFi
    if (f.includes('defi') || f.includes('yield') || f.includes('pool') || f.includes('staking') ||
        f.includes('bridge') || f.includes('protocol') || f.includes('governance') ||
        f.includes('stablecoin') || f.includes('stableflow') || f.includes('il-') ||
        f.includes('airdrop') || f.includes('portfolio') || f.includes('funding') ||
        f.includes('liquidat') || f.includes('tvl') || f.includes('wallet') ||
        f.includes('nft')) return 'defi';

    // Analytics / Tracking
    if (f.includes('whale') || f.includes('track') || f.includes('scan') || f.includes('alert') ||
        f.includes('watchlist') || f.includes('trending') || f.includes('heatmap') ||
        f.includes('onchain') || f.includes('analytics') || f.includes('smart-money') ||
        f.includes('mev') || f.includes('openinterest') || f.includes('feargreed') ||
        f.includes('correlation') || f.includes('signal') || f.includes('options') ||
        f.includes('arbitrage') || f.includes('new-pairs') || f.includes('unlock') ||
        f.includes('gas') || f.includes('explorer') || f.includes('block')) return 'analytics';

    // Social / News
    if (f.includes('news') || f.includes('social') || f.includes('chat') || f.includes('sentiment') ||
        f.includes('twitter') || f.includes('feed') || f.includes('research')) return 'social';

    // Tools — Lair system apps and utilities
    if (f.includes('calc') || f.includes('convert') || f.includes('tool') || f.includes('note') ||
        f.includes('json') || f.includes('pdf') || f.includes('editor') || f.includes('timer') ||
        f.includes('unit') || f.includes('calendar') || f.includes('datamgr') || f.includes('cli') ||
        f.includes('terminal') || f.includes('lairai') || f.includes('lairbot') ||
        f.includes('lairdocs') || f.includes('lairterminal') || f.includes('copilot') ||
        f.includes('liza') || f.includes('settings') || f.includes('files') ||
        f.includes('store') || f.includes('welcome') || f.includes('dashboard') ||
        f.includes('studio') || f.includes('browser') || f.includes('camera') ||
        f.includes('gallery') || f.includes('music') || f.includes('text') ||
        f.includes('hotkey') || f.includes('layout') || f.includes('notification') ||
        f.includes('address-book') || f.includes('time')) return 'tools';

    // Crypto / DeFi specific apps
    if (f.includes('laircoin') || f.includes('lairlaunch') || f.includes('risk')) return 'defi';

    // Fun / Games
    if (f.includes('game') || f.includes('tictactoe') || f.includes('duck') || f.includes('obama') ||
        f.includes('badthing') || f.includes('claw') || f.includes('dot') || f.includes('paint')) return 'fun';

    // Launcher
    if (f.includes('origin') || f.includes('nvamine') || f.includes('rotur')) return 'launcher';

    // Content-based inference as fallback
    const lc = content.toLowerCase();
    if (lc.includes('coingecko') || lc.includes('coinmarketcap') || lc.includes('binance') ||
        lc.includes('tradingview') || lc.includes('candlestick')) return 'trading';
    if (lc.includes('defi') || lc.includes('staking') || lc.includes('yield') ||
        lc.includes('liquidity') || lc.includes('protocol')) return 'defi';
    if (lc.includes('whale') || lc.includes('on-chain') || lc.includes('onchain') ||
        lc.includes('heatmap') || lc.includes('scanner')) return 'analytics';

    return 'general';
}

/**
 * Convert a filename to a slug-style ID.
 * e.g. "crypto-charts.html" → "crypto-charts"
 */
function filenameToId(filename) {
    return path.basename(filename, '.html').toLowerCase();
}

/**
 * Format file size as a human-readable string.
 */
function formatSize(bytes) {
    if (bytes < 1024) return bytes + 'B';
    const kb = bytes / 1024;
    if (kb < 1024) return kb.toFixed(0) + 'KB';
    return (kb / 1024).toFixed(1) + 'MB';
}

/**
 * Parse a single HTML app file and extract catalog metadata.
 */
function parseAppFile(filePath, srcPrefix) {
    const html = fs.readFileSync(filePath, 'utf8');
    const filename = path.basename(filePath);
    const stat = fs.statSync(filePath);

    const title = getTitle(html);
    if (!title) {
        return { skipped: true, filename, reason: 'no <title> tag' };
    }

    const id = filenameToId(filename);
    const icon = getMeta(html, 'lair-icon') || null;
    const permissions = getMeta(html, 'permissions');
    const capabilities = getMeta(html, 'capabilities');
    const description = getMeta(html, 'description');
    const category = getMeta(html, 'lair-category');
    const author = getMeta(html, 'lair-author');
    const version = getMeta(html, 'lair-version');
    const isWidget = getMeta(html, 'lair-widget') === 'true';
    const widgetSize = getMeta(html, 'lair-widget-size');
    const lairInclude = getMeta(html, 'lair-include');

    // Determine the src path relative to the OS root
    const src = srcPrefix + '/' + filename;

    const entry = {
        id,
        name: title,
        src,
        by: author || 'PumpOS',
        desc: description || '',
        cat: category || inferCategory(filename, html),
        ver: version || '1.0',
        symbol: null, // Will be set from icon if it's a material symbol name
        th: null,     // Will be merged from existing v2.json
    };

    // Determine icon type: SVG string or material symbol name
    if (icon) {
        if (icon.startsWith('<svg') || icon.startsWith('<SVG')) {
            // Full SVG icon — store in a separate field for the catalog
            entry._svgIcon = icon;
        } else if (icon.startsWith('../../') || icon.startsWith('/') || icon.endsWith('.svg') || icon.endsWith('.png')) {
            // Path reference to an asset
            entry._svgIcon = icon;
        } else {
            // Material symbol name (e.g. "candlestick_chart")
            entry.symbol = icon;
        }
    }

    if (permissions) {
        entry.permissions = permissions.split(',').map(p => p.trim()).filter(Boolean);
    }

    if (capabilities) {
        entry.capabilities = capabilities.split(',').map(c => c.trim()).filter(Boolean);
    }

    if (isWidget) {
        entry.widget = true;
        if (widgetSize) {
            entry.widgetSize = widgetSize;
        }
    }

    entry.size = formatSize(stat.size);
    entry.lairInclude = !!lairInclude;

    return { skipped: false, entry };
}

/**
 * Read and parse the existing v2.json to preserve manual overrides.
 */
function loadExistingCatalog() {
    if (!fs.existsSync(OUTPUT_FILE)) return null;
    try {
        return JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf8'));
    } catch (e) {
        console.warn(`⚠️  Could not parse existing v2.json: ${e.message}`);
        return null;
    }
}

/**
 * Build an index of existing apps by their src path for merge lookups.
 */
function indexExistingApps(catalog) {
    const bySrc = {};
    const byName = {};
    if (!catalog || !catalog.apps) return { bySrc, byName };
    for (const app of catalog.apps) {
        if (app.src) bySrc[app.src] = app;
        if (app.name) byName[app.name.toLowerCase()] = app;
    }
    return { bySrc, byName };
}

// Legacy categories that should be re-inferred from filename/content
const LEGACY_CATEGORIES = new Set(['dapps', 'general']);

/**
 * Merge a generated entry with an existing one, preserving manual overrides.
 * Generated data fills in gaps; existing manual data takes precedence for:
 *   name, qt, desc, ldesc, symbol, th, cat, by, img, disabled
 * Exception: legacy categories (e.g. 'dapps') are re-inferred.
 */
function mergeEntry(generated, existing) {
    if (!existing) return generated;

    const merged = { ...generated };

    // Manual overrides take precedence for these fields
    const manualFields = ['name', 'qt', 'desc', 'ldesc', 'symbol', 'th', 'cat', 'by', 'img', 'disabled', 'ver'];
    for (const field of manualFields) {
        if (existing[field] !== undefined && existing[field] !== null && existing[field] !== '') {
            // Don't preserve legacy categories — let the generator re-infer
            if (field === 'cat' && LEGACY_CATEGORIES.has(existing[field])) continue;
            merged[field] = existing[field];
        }
    }

    // Preserve widget settings from existing if present
    if (existing.widget !== undefined) merged.widget = existing.widget;
    if (existing.widgetSize) merged.widgetSize = existing.widgetSize;

    return merged;
}

/**
 * Clean an entry for final JSON output — remove internal fields.
 */
function cleanEntry(entry) {
    const clean = { ...entry };

    // If we have an SVG icon and no material symbol was set from existing
    if (clean._svgIcon && !clean.symbol) {
        // Store the SVG icon — check if it's an icon path or inline SVG
        if (clean._svgIcon.startsWith('<svg') || clean._svgIcon.startsWith('<SVG')) {
            clean.icon = clean._svgIcon;
        } else {
            clean.icon = clean._svgIcon;
        }
    }

    // Remove internal fields
    delete clean._svgIcon;
    delete clean.lairInclude;

    // Remove null/empty fields for a cleaner JSON
    if (!clean.symbol) delete clean.symbol;
    if (!clean.th) delete clean.th;
    if (!clean.qt) delete clean.qt;
    if (!clean.ldesc) delete clean.ldesc;
    if (!clean.img) delete clean.img;
    if (!clean.disabled) delete clean.disabled;
    if (!clean.icon) delete clean.icon;
    if (!clean.permissions || clean.permissions.length === 0) delete clean.permissions;
    if (!clean.capabilities || clean.capabilities.length === 0) delete clean.capabilities;

    return clean;
}

// ── Main ─────────────────────────────────────────────────────────────────────

function main() {
    console.log('🏪 PumpOS Store Catalog Generator');
    console.log('==================================\n');

    // 1. Load existing v2.json for merge
    const existing = loadExistingCatalog();
    const { bySrc, byName } = indexExistingApps(existing);

    if (existing) {
        console.log(`📦 Found existing v2.json with ${existing.apps?.length || 0} apps`);
    } else {
        console.log('📦 No existing v2.json found — generating from scratch');
    }

    // 2. Scan app directories
    const dirs = [
        { dir: STORE_APPS_DIR, prefix: '/Pump-Store/apps' },
        { dir: APPDATA_DIR, prefix: '/appdata' },
    ];

    // Apps where appdata/ has the real implementation and Pump-Store/ is a stub
    const PREFER_APPDATA = new Set([
        'lairai', 'lairbot', 'lairdefi', 'lairdocs', 'dashboard',
    ]);

    const allEntries = [];
    const skipped = [];
    const seenIds = new Set();
    const seenSrcs = new Set();
    const entriesById = new Map(); // id → { entry, index }

    for (const { dir, prefix } of dirs) {
        if (!fs.existsSync(dir)) {
            console.warn(`⚠️  Directory not found: ${dir}`);
            continue;
        }

        const files = fs.readdirSync(dir)
            .filter(f => f.endsWith('.html'))
            .sort();

        console.log(`\n📂 Scanning ${path.relative(OS_ROOT, dir)}/ (${files.length} HTML files)`);

        for (const file of files) {
            const filePath = path.join(dir, file);
            const result = parseAppFile(filePath, prefix);

            if (result.skipped) {
                skipped.push(result);
                console.log(`   ⏭️  ${file} — skipped (${result.reason})`);
                continue;
            }

            const entry = result.entry;

            // Deduplicate handling
            if (seenIds.has(entry.id)) {
                // If appdata has the preferred version, replace the Store stub
                if (PREFER_APPDATA.has(entry.id) && prefix === '/appdata') {
                    const prev = entriesById.get(entry.id);
                    if (prev) {
                        // Keep old src in seenSrcs to prevent re-adding via preservation
                        const existingEntry = bySrc[entry.src] || byName[entry.name.toLowerCase()];
                        const merged = mergeEntry(entry, existingEntry);
                        const cleaned = cleanEntry(merged);
                        allEntries[prev.index] = cleaned;
                        seenSrcs.add(entry.src);
                        entriesById.set(entry.id, { entry: cleaned, index: prev.index });
                        console.log(`   🔄 ${file} — replaced Store stub for "${entry.id}"`);
                    }
                } else {
                    console.log(`   ⚠️  ${file} — duplicate ID "${entry.id}", skipping`);
                }
                continue;
            }

            // Merge with existing v2.json data
            const existingEntry = bySrc[entry.src] || byName[entry.name.toLowerCase()];
            const merged = mergeEntry(entry, existingEntry);
            const cleaned = cleanEntry(merged);

            entriesById.set(entry.id, { entry: cleaned, index: allEntries.length });
            allEntries.push(cleaned);
            seenIds.add(entry.id);
            seenSrcs.add(entry.src);
        }
    }

    // 3. Preserve apps from existing v2.json that were NOT found in file scan,
    //    but only if their referenced file actually exists (skip stale entries)
    let preservedCount = 0;
    let droppedCount = 0;
    if (existing && existing.apps) {
        for (const app of existing.apps) {
            if (app.src && !seenSrcs.has(app.src)) {
                // Check if the file exists on disk
                const localPath = (app.src.startsWith('/Pump-Store/') || app.src.startsWith('/appdata/'))
                    ? path.join(OS_ROOT, app.src)
                    : null;
                if (localPath && !fs.existsSync(localPath)) {
                    console.log(`   🗑️  Dropping stale entry: "${app.name}" → ${app.src} (file missing)`);
                    droppedCount++;
                    continue;
                }
                allEntries.push(app);
                preservedCount++;
            }
        }
    }
    if (preservedCount > 0) {
        console.log(`\n🔒 Preserved ${preservedCount} manually-added entries from existing v2.json`);
    }
    if (droppedCount > 0) {
        console.log(`🗑️  Dropped ${droppedCount} stale entries (missing files)`);
    }

    // 4. Collect categories
    const categories = [...new Set(allEntries.map(a => a.cat))].sort();

    // 5. Build final catalog
    const catalog = {
        vdevs: existing?.vdevs || ['nich'],
        featured: existing?.featured || [],
        apps: allEntries,
        categories,
        generated: new Date().toISOString(),
        totalApps: allEntries.length,
    };

    // 6. Backup existing v2.json
    if (fs.existsSync(OUTPUT_FILE)) {
        const backupPath = OUTPUT_FILE + '.bak';
        fs.copyFileSync(OUTPUT_FILE, backupPath);
        console.log(`\n💾 Backed up existing v2.json → v2.json.bak`);
    }

    // 7. Write output
    const outputDir = path.dirname(OUTPUT_FILE);
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(catalog, null, 2) + '\n', 'utf8');

    // 8. Summary
    console.log(`\n✅ Generated ${path.relative(OS_ROOT, OUTPUT_FILE)}`);
    console.log(`   📊 ${allEntries.length} apps total`);
    console.log(`   🏷️  ${categories.length} categories: ${categories.join(', ')}`);

    if (skipped.length > 0) {
        console.log(`   ⏭️  ${skipped.length} files skipped`);
    }

    // 9. Print category breakdown
    const catCounts = {};
    for (const app of allEntries) {
        catCounts[app.cat] = (catCounts[app.cat] || 0) + 1;
    }
    console.log('\n📊 Category Breakdown:');
    for (const [cat, count] of Object.entries(catCounts).sort((a, b) => b[1] - a[1])) {
        console.log(`   ${cat}: ${count}`);
    }

    // 10. Warn about apps in v2.json whose files no longer exist
    if (existing && existing.apps) {
        const missingFiles = [];
        for (const app of existing.apps) {
            if (app.src && (app.src.startsWith('/Pump-Store/apps/') || app.src.startsWith('/appdata/'))) {
                const fullPath = path.join(OS_ROOT, app.src);
                if (!fs.existsSync(fullPath)) {
                    missingFiles.push(app);
                }
            }
        }
        if (missingFiles.length > 0) {
            console.log(`\n⚠️  ${missingFiles.length} apps in old v2.json reference missing files:`);
            for (const app of missingFiles) {
                console.log(`   ❌ "${app.name}" → ${app.src}`);
            }
        }
    }

    console.log('\nDone! 🎉');
}

main();
