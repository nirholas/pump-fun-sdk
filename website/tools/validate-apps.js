#!/usr/bin/env node
// packages/os/tools/validate-apps.js
// PumpOS App Validator & Linter — read-only validation of all apps
// Uses only Node.js built-ins (fs, path, https, http, url)

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { URL } = require('url');

// ─── Config ──────────────────────────────────────────────────────────────────

const APP_DIRS = [
    path.join(__dirname, '../Pump-Store/apps'),
    path.join(__dirname, '../appdata'),
];

const MAX_FILE_SIZE = 200 * 1024; // 200 KB
const API_TIMEOUT_MS = 8000;
const MAX_CONCURRENT_REQUESTS = 10;

// Whitelisted external domains for script/link imports
const EXTERNAL_WHITELIST = [
    'fonts.googleapis.com',
    'fonts.gstatic.com',
];

// Patterns that indicate mock/placeholder data
const MOCK_PATTERNS = [
    { pattern: /Math\.random\(\)/, label: 'Math.random()' },
    { pattern: /\b(mock|fake)\b/i, label: 'mock/fake keyword' },
    { pattern: /sample\s*data|dummy\s*data|test\s*data/i, label: 'sample/dummy/test data' },
    { pattern: /generateFake|generateMock|generateSample/i, label: 'generate fake/mock/sample' },
    { pattern: /\b(TODO|FIXME|HACK|XXX)\b/, label: 'TODO/FIXME/HACK/XXX' },
    { pattern: /lorem ipsum/i, label: 'lorem ipsum' },
];

// Lines matching these patterns are NOT mock data (legitimate uses)
const MOCK_WHITELIST_PATTERNS = [
    /placeholder\s*[:=]/i,                    // HTML placeholder attribute
    /placeholder["']/i,                        // placeholder="text"
    /\.placeholder/i,                          // element.placeholder
    /::placeholder/i,                          // CSS ::placeholder pseudo-element
];

// Regex for extracting fetch URLs
const FETCH_PATTERN = /fetch\s*\(\s*[`'"](https?:\/\/[^`'"]+)[`'"]/g;

// Regex for hardcoded hex colors
const HARDCODED_COLOR_PATTERN = /#[0-9a-f]{3,8}\b/gi;

// Regex for external script/link imports
const EXTERNAL_IMPORT_PATTERN = /<(?:script|link)\b[^>]*?(?:src|href)\s*=\s*["'](https?:\/\/[^"']+)["']/gi;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function collectHtmlFiles(dirs) {
    const files = [];
    for (const dir of dirs) {
        if (!fs.existsSync(dir)) continue;
        const dirLabel = path.basename(path.dirname(dir)) === 'os'
            ? path.basename(dir)
            : `${path.basename(path.dirname(dir))}/${path.basename(dir)}`;
        for (const name of fs.readdirSync(dir)) {
            if (!name.endsWith('.html')) continue;
            files.push({ filePath: path.join(dir, name), name, dirLabel });
        }
    }
    return files;
}

/**
 * Check a single URL via HEAD request. Returns { status, ok, label }.
 */
function checkUrl(url) {
    return new Promise((resolve) => {
        const timeout = setTimeout(() => {
            req.destroy();
            resolve({ url, status: 0, label: '⏱️  Timeout' });
        }, API_TIMEOUT_MS);

        let mod;
        try {
            const parsed = new URL(url);
            mod = parsed.protocol === 'https:' ? https : http;
        } catch {
            clearTimeout(timeout);
            resolve({ url, status: 0, label: '❌ Invalid URL' });
            return;
        }

        const req = mod.request(url, { method: 'HEAD', timeout: API_TIMEOUT_MS }, (res) => {
            clearTimeout(timeout);
            const s = res.statusCode;
            if (s >= 200 && s < 300) {
                resolve({ url, status: s, label: `✅ ${s}` });
            } else if (s === 403 || s === 429) {
                resolve({ url, status: s, label: `⚠️  ${s} Rate limited` });
            } else if (s >= 300 && s < 400) {
                // Follow one redirect
                const location = res.headers.location;
                if (location) {
                    clearTimeout(timeout);
                    resolve(checkUrl(location));
                } else {
                    resolve({ url, status: s, label: `⚠️  ${s} Redirect (no location)` });
                }
            } else {
                resolve({ url, status: s, label: `❌ ${s}` });
            }
        });

        req.on('error', () => {
            clearTimeout(timeout);
            resolve({ url, status: 0, label: '❌ Connection error' });
        });

        req.end();
    });
}

/**
 * Run up to `limit` promises concurrently.
 */
async function parallelLimit(tasks, limit) {
    const results = [];
    let idx = 0;
    async function worker() {
        while (idx < tasks.length) {
            const i = idx++;
            results[i] = await tasks[i]();
        }
    }
    await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, () => worker()));
    return results;
}

/**
 * Determine if a line with a hardcoded color should be ignored.
 * Whitelisted contexts: SVG icons, lair-icon meta, CSS var() fallbacks,
 * CSS custom property definitions, gradient definitions.
 */
function isColorWhitelisted(line) {
    // Inside lair-icon meta content (SVGs use fill="#xxx")
    if (/lair-icon/i.test(line)) return true;
    // Inside an <svg> element (standalone SVG or inline)
    if (/<svg\b/i.test(line) || /<\/svg>/i.test(line) || /\bfill\s*=\s*["']/i.test(line) || /\bstroke\s*=\s*["']/i.test(line)) return true;
    // CSS gradient definitions are acceptable
    if (/gradient/i.test(line)) return true;
    // Common fallback patterns e.g. var(--col-bg1, #101010) are fine
    if (/var\s*\(--[^)]+,\s*#/i.test(line)) return true;
    // CSS custom property definitions: --my-color: #abc; (this IS defining a variable)
    if (/--[\w-]+\s*:\s*#/i.test(line)) return true;
    return false;
}

// ─── Validators ──────────────────────────────────────────────────────────────

function validateMetaTags(content, lines) {
    const issues = [];

    // Check lair-include meta
    if (!/<meta\s+name\s*=\s*["']lair-include["']/i.test(content)) {
        issues.push({ severity: 'error', msg: 'Missing meta: lair-include' });
    }

    // Check charset
    if (!/<meta\s+charset\s*=\s*["']UTF-8["']/i.test(content)) {
        issues.push({ severity: 'warn', msg: 'Missing <meta charset="UTF-8">' });
    }

    // Check viewport
    if (!/<meta\s+name\s*=\s*["']viewport["']/i.test(content)) {
        issues.push({ severity: 'warn', msg: 'Missing <meta name="viewport" ...>' });
    }

    // Check title
    const titleMatch = content.match(/<title>(.*?)<\/title>/i);
    if (!titleMatch || !titleMatch[1].trim()) {
        issues.push({ severity: 'warn', msg: '<title> tag missing or empty' });
    }

    return issues;
}

function validateMockData(content, lines) {
    const issues = [];
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Skip lines that match whitelist (HTML placeholder attrs, CSS ::placeholder, etc.)
        if (MOCK_WHITELIST_PATTERNS.some((wp) => wp.test(line))) continue;

        for (const { pattern, label } of MOCK_PATTERNS) {
            const match = line.match(pattern);
            if (match) {
                issues.push({
                    severity: 'warn',
                    msg: `Line ${i + 1}: Possible mock data: ${label} — "${match[0]}"`,
                });
            }
        }
    }
    return issues;
}

function validateCssVariables(content, lines) {
    const issues = [];
    let inStyle = false;
    let inScript = false;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        if (/<style\b/i.test(line)) inStyle = true;
        if (/<\/style>/i.test(line)) inStyle = false;
        if (/<script\b/i.test(line)) inScript = true;
        if (/<\/script>/i.test(line)) inScript = false;

        // Only check CSS sections and inline styles
        if (!inStyle && !/style\s*=/i.test(line)) continue;

        // Skip whitelisted contexts
        if (isColorWhitelisted(line)) continue;

        const matches = line.matchAll(HARDCODED_COLOR_PATTERN);
        for (const m of matches) {
            // Double check the surrounding context isn't a var() fallback
            const before = line.substring(0, m.index);
            if (/var\s*\([^)]*,\s*$/.test(before)) continue;

            issues.push({
                severity: 'warn',
                msg: `Line ${i + 1}: Hardcoded color ${m[0]} (consider using CSS variable)`,
            });
        }
    }

    // Cap to first 5 hardcoded color warnings per file to reduce noise
    const MAX_COLOR_WARNINGS = 5;
    if (issues.length > MAX_COLOR_WARNINGS) {
        const total = issues.length;
        issues.length = MAX_COLOR_WARNINGS;
        issues.push({
            severity: 'warn',
            msg: `... and ${total - MAX_COLOR_WARNINGS} more hardcoded colors`,
        });
    }
    return issues;
}

function validateExternalDeps(content, lines) {
    const issues = [];
    let match;
    const pattern = new RegExp(EXTERNAL_IMPORT_PATTERN.source, EXTERNAL_IMPORT_PATTERN.flags);

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        pattern.lastIndex = 0;
        while ((match = pattern.exec(line)) !== null) {
            const url = match[1];
            try {
                const hostname = new URL(url).hostname;
                if (EXTERNAL_WHITELIST.some((w) => hostname === w || hostname.endsWith('.' + w))) {
                    continue;
                }
            } catch { /* malformed URL — flag it */ }
            issues.push({
                severity: 'warn',
                msg: `Line ${i + 1}: External dependency: ${url}`,
            });
        }
    }
    return issues;
}

function validateFileSize(filePath) {
    const issues = [];
    const stat = fs.statSync(filePath);
    if (stat.size > MAX_FILE_SIZE) {
        const kb = (stat.size / 1024).toFixed(1);
        issues.push({
            severity: 'warn',
            msg: `File size ${kb}KB exceeds ${MAX_FILE_SIZE / 1024}KB limit`,
        });
    }
    return issues;
}

function extractFetchUrls(content) {
    const urls = new Set();
    let match;
    const pattern = new RegExp(FETCH_PATTERN.source, FETCH_PATTERN.flags);
    while ((match = pattern.exec(content)) !== null) {
        let url = match[1];
        // Skip URLs with template literal expressions — can't reliably test them
        if (/\$\{/.test(url)) continue;
        urls.add(url);
    }
    return [...urls];
}

function extractTitle(content) {
    const m = content.match(/<title>(.*?)<\/title>/i);
    return m ? m[1].trim() : '';
}

// ─── Duplicate Detection ─────────────────────────────────────────────────────

function detectDuplicates(fileResults) {
    const issues = new Map(); // filePath → issues[]

    // By title
    const titleMap = new Map();
    for (const { filePath, title } of fileResults) {
        if (!title) continue;
        const key = title.toLowerCase();
        if (!titleMap.has(key)) titleMap.set(key, []);
        titleMap.get(key).push(filePath);
    }
    for (const [title, paths] of titleMap) {
        if (paths.length <= 1) continue;
        for (const p of paths) {
            if (!issues.has(p)) issues.set(p, []);
            const others = paths.filter((x) => x !== p).map((x) => path.basename(x));
            issues.get(p).push({
                severity: 'warn',
                msg: `Duplicate title "${title}" — also in: ${others.join(', ')}`,
            });
        }
    }

    // By similar filename (strip common prefixes/suffixes, compare stems)
    // Skip exact same filename in different dirs — that's flagged by title dupe above
    const nameMap = new Map();
    for (const { filePath, name } of fileResults) {
        const stem = name.replace(/\.html$/, '').replace(/^(widget-|lair)/, '').replace(/[-_]/g, '').toLowerCase();
        if (!stem) continue;
        if (!nameMap.has(stem)) nameMap.set(stem, []);
        nameMap.get(stem).push({ filePath, name });
    }
    for (const [, entries] of nameMap) {
        if (entries.length <= 1) continue;
        // Filter out entries with the exact same filename (same file in both dirs)
        const uniqueNames = new Set(entries.map((e) => e.name));
        if (uniqueNames.size <= 1) continue; // All same name — skip (already caught by title dupe)
        for (const { filePath, name } of entries) {
            if (!issues.has(filePath)) issues.set(filePath, []);
            const others = entries.filter((e) => e.filePath !== filePath && e.name !== name).map((e) => e.name);
            if (others.length === 0) continue;
            issues.get(filePath).push({
                severity: 'warn',
                msg: `Similar filename to: ${others.join(', ')}`,
            });
        }
    }

    return issues;
}

// ─── Auto-Fix ────────────────────────────────────────────────────────────────

const META_TAG = '<meta name="lair-include" content="lair.css">';

/**
 * Attempt to inject lair-include meta tag into a file.
 * Returns true if the file was modified.
 */
function fixMissingLairInclude(filePath, content) {
    if (/<meta\s+name\s*=\s*["']lair-include["']/i.test(content)) return false;
    if (content.trim().length === 0) return false; // skip empty files

    let newContent;
    const charsetMatch = content.match(/(<meta\s+charset\s*=\s*["'][^"']*["']\s*\/?>)/i);
    if (charsetMatch) {
        const idx = content.indexOf(charsetMatch[0]) + charsetMatch[0].length;
        newContent = content.slice(0, idx) + '\n    ' + META_TAG + content.slice(idx);
    } else {
        const headMatch = content.match(/<head[^>]*>/i);
        if (headMatch) {
            const idx = content.indexOf(headMatch[0]) + headMatch[0].length;
            newContent = content.slice(0, idx) + '\n    ' + META_TAG + content.slice(idx);
        } else {
            newContent = META_TAG + '\n' + content;
        }
    }
    fs.writeFileSync(filePath, newContent, 'utf-8');
    return true;
}

/**
 * Delete empty HTML files.
 * Returns true if the file was removed.
 */
function fixEmptyFile(filePath, content) {
    if (content.trim().length > 0) return false;
    fs.unlinkSync(filePath);
    return true;
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
    const skipApi = process.argv.includes('--skip-api');
    const verbose = process.argv.includes('--verbose');
    const fix = process.argv.includes('--fix');

    console.log('🔍 PumpOS App Validator');
    console.log('========================\n');

    const files = collectHtmlFiles(APP_DIRS);
    if (files.length === 0) {
        console.log('No HTML files found in app directories.');
        process.exit(0);
    }

    console.log(`Scanning ${files.length} files...\n`);

    // Phase 0: Auto-fix (when --fix is passed)
    if (fix) {
        let fixedCount = 0;
        let removedCount = 0;
        const remaining = [];

        for (const entry of files) {
            const content = fs.readFileSync(entry.filePath, 'utf-8');

            // Remove empty files
            if (fixEmptyFile(entry.filePath, content)) {
                console.log(`🗑️  Removed empty file: ${entry.dirLabel}/${entry.name}`);
                removedCount++;
                continue;
            }

            // Inject missing lair-include
            if (fixMissingLairInclude(entry.filePath, content)) {
                console.log(`🔧 Fixed lair-include: ${entry.dirLabel}/${entry.name}`);
                fixedCount++;
            }

            remaining.push(entry);
        }

        if (fixedCount > 0 || removedCount > 0) {
            console.log(`\n✅ Auto-fixed: ${fixedCount} files patched, ${removedCount} empty files removed\n`);
        } else {
            console.log('✅ Nothing to auto-fix.\n');
        }

        // Continue validation with remaining files only
        files.length = 0;
        files.push(...remaining);
    }

    // Phase 1: Per-file validation (synchronous)
    const fileResults = [];
    const allFetchUrls = new Map(); // url → Set<filePath>

    for (const { filePath, name, dirLabel } of files) {
        const content = fs.readFileSync(filePath, 'utf-8');
        const lines = content.split('\n');
        const title = extractTitle(content);
        const issues = [];

        issues.push(...validateMetaTags(content, lines));
        issues.push(...validateMockData(content, lines));
        issues.push(...validateCssVariables(content, lines));
        issues.push(...validateExternalDeps(content, lines));
        issues.push(...validateFileSize(filePath));

        // Collect fetch URLs for batch checking
        for (const url of extractFetchUrls(content)) {
            if (!allFetchUrls.has(url)) allFetchUrls.set(url, new Set());
            allFetchUrls.get(url).add(filePath);
        }

        fileResults.push({ filePath, name, dirLabel, title, issues });
    }

    // Phase 2: Duplicate detection
    const dupeIssues = detectDuplicates(fileResults);
    for (const fr of fileResults) {
        const extras = dupeIssues.get(fr.filePath);
        if (extras) fr.issues.push(...extras);
    }

    // Phase 3: API endpoint health check
    const apiResults = new Map(); // url → result
    if (!skipApi && allFetchUrls.size > 0) {
        console.log(`Checking ${allFetchUrls.size} unique API endpoints...\n`);
        const urls = [...allFetchUrls.keys()];
        const tasks = urls.map((url) => () => checkUrl(url));
        const results = await parallelLimit(tasks, MAX_CONCURRENT_REQUESTS);
        for (const result of results) {
            apiResults.set(result.url, result);
        }

        // Attach API issues to files
        for (const [url, filePaths] of allFetchUrls) {
            const result = apiResults.get(url);
            if (!result) continue;
            const { status, label } = result;
            if (status >= 200 && status < 300) continue; // OK — no issue
            const severity = (status === 403 || status === 429) ? 'warn' : 'error';
            for (const fp of filePaths) {
                const fr = fileResults.find((f) => f.filePath === fp);
                if (fr) {
                    fr.issues.push({ severity, msg: `API endpoint ${label}: ${url}` });
                }
            }
        }
    } else if (allFetchUrls.size > 0) {
        console.log(`Skipping API checks (--skip-api). ${allFetchUrls.size} endpoints found.\n`);
    }

    // Phase 4: Report
    let countPass = 0;
    let countWarn = 0;
    let countError = 0;

    for (const { name, dirLabel, issues } of fileResults) {
        const errors = issues.filter((i) => i.severity === 'error');
        const warns = issues.filter((i) => i.severity === 'warn');
        const label = `${dirLabel}/${name}`;

        if (errors.length > 0) {
            countError++;
            console.log(`❌ ${label}`);
            for (let i = 0; i < issues.length; i++) {
                const issue = issues[i];
                const prefix = i === issues.length - 1 ? '└─' : '├─';
                const icon = issue.severity === 'error' ? '❌' : '⚠️ ';
                console.log(`   ${prefix} ${icon} ${issue.msg}`);
            }
        } else if (warns.length > 0) {
            countWarn++;
            if (verbose) {
                console.log(`⚠️  ${label}`);
                for (let i = 0; i < warns.length; i++) {
                    const prefix = i === warns.length - 1 ? '└─' : '├─';
                    console.log(`   ${prefix} ${warns[i].msg}`);
                }
            }
        } else {
            countPass++;
            if (verbose) {
                const checks = 5 + (skipApi ? 0 : 1);
                console.log(`✅ ${label} — ${checks} checks passed`);
            }
        }
    }

    // API endpoint summary
    if (!skipApi && apiResults.size > 0) {
        const ok = [...apiResults.values()].filter((r) => r.status >= 200 && r.status < 300).length;
        const rateLimited = [...apiResults.values()].filter((r) => r.status === 403 || r.status === 429).length;
        const broken = [...apiResults.values()].filter((r) => r.status === 0 || r.status >= 400).length - rateLimited;
        console.log(`\nAPI Endpoints: ${ok} ✅  ${rateLimited} ⚠️  ${broken} ❌  (${apiResults.size} total)`);
    }

    console.log(`\nSummary: ${countPass} ✅  ${countWarn} ⚠️  ${countError} ❌  (${files.length} files)`);

    if (!verbose && (countWarn > 0 || countError > 0)) {
        console.log('\nTip: Run with --verbose to see all warnings and passing files.');
    }
    if (!fix && countError > 0) {
        console.log('Tip: Run with --fix to auto-fix missing lair-include and remove empty files.');
    }

    // Exit code: 1 if any errors
    process.exit(countError > 0 ? 1 : 0);
}

main().catch((err) => {
    console.error('Validator crashed:', err);
    process.exit(2);
});
