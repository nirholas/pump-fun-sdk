#!/usr/bin/env node
/**
 * fix-lair-include.js
 * Injects <meta name="lair-include" content="lair.css"> into HTML files missing it.
 * Runs after validate-apps.js identifies which files lack the tag.
 *
 * Usage: node fix-lair-include.js [--dry-run]
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DIRS = [
  path.join(ROOT, 'Pump-Store', 'apps'),
  path.join(ROOT, 'appdata'),
];

const META_TAG = '<meta name="lair-include" content="lair.css">';
const dryRun = process.argv.includes('--dry-run');

let fixed = 0;
let skipped = 0;
let empty = 0;
let errors = 0;

for (const dir of DIRS) {
  if (!fs.existsSync(dir)) continue;
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.html'));

  for (const file of files) {
    const fp = path.join(dir, file);
    const rel = path.relative(ROOT, fp);
    let content;

    try {
      content = fs.readFileSync(fp, 'utf-8');
    } catch (e) {
      console.log(`⚠️  Cannot read: ${rel}`);
      errors++;
      continue;
    }

    // Skip empty files
    if (content.trim().length === 0) {
      console.log(`⏭️  Empty file: ${rel}`);
      empty++;
      continue;
    }

    // Already has lair-include
    if (content.includes('lair-include')) {
      skipped++;
      continue;
    }

    // Strategy: inject after <meta charset="..."> line, or after <head> if no charset
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
        // No <head> tag — inject at very top before <!DOCTYPE> or <html>
        newContent = META_TAG + '\n' + content;
      }
    }

    if (dryRun) {
      console.log(`🔧 Would fix: ${rel}`);
    } else {
      fs.writeFileSync(fp, newContent, 'utf-8');
      console.log(`✅ Fixed: ${rel}`);
    }
    fixed++;
  }
}

console.log(`\n--- Summary ---`);
console.log(`Fixed: ${fixed}  Skipped (already has tag): ${skipped}  Empty: ${empty}  Errors: ${errors}`);
if (dryRun) console.log('(dry-run mode — no files were modified)');
