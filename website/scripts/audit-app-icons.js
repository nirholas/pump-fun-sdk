const fs = require('node:fs');
const path = require('node:path');

const rootDir = path.resolve(__dirname, '..');

const htmlTargets = [
  path.join(rootDir, 'appdata'),
  path.join(rootDir, 'Pump-Store', 'apps'),
];

const storeDbPath = path.join(rootDir, 'Pump-Store', 'db', 'v2.json');

function readHtmlFiles(dir) {
  if (!fs.existsSync(dir)) {
    return [];
  }

  return fs
    .readdirSync(dir)
    .filter((fileName) => fileName.endsWith('.html'))
    .map((fileName) => path.join(dir, fileName));
}

function hasPumpIconMeta(content) {
  const regex = /<meta\s+name=["']pump-icon["']\s+content=["']([^"']*)["']/i;
  const match = content.match(regex);
  return Boolean(match && match[1] && match[1].trim().length > 0);
}

function auditHtmlIcons() {
  const missing = [];

  for (const dir of htmlTargets) {
    for (const filePath of readHtmlFiles(dir)) {
      const content = fs.readFileSync(filePath, 'utf8');
      if (!hasPumpIconMeta(content)) {
        missing.push(path.relative(rootDir, filePath));
      }
    }
  }

  return missing;
}

function auditStoreSymbols() {
  if (!fs.existsSync(storeDbPath)) {
    return ['Pump-Store/db/v2.json (missing file)'];
  }

  const db = JSON.parse(fs.readFileSync(storeDbPath, 'utf8'));
  const apps = Array.isArray(db.apps) ? db.apps : [];
  return apps
    .filter((app) => !String(app.symbol ?? '').trim())
    .map((app) => `Pump-Store/db/v2.json: ${app.name ?? '<unnamed app>'}`);
}

const missingHtmlIcons = auditHtmlIcons();
const missingStoreSymbols = auditStoreSymbols();

if (missingHtmlIcons.length || missingStoreSymbols.length) {
  console.error('❌ App icon audit failed. Missing icon metadata in:');

  if (missingHtmlIcons.length) {
    console.error('\nHTML files missing <meta name="pump-icon">:');
    for (const item of missingHtmlIcons) {
      console.error(`- ${item}`);
    }
  }

  if (missingStoreSymbols.length) {
    console.error('\nStore apps missing "symbol":');
    for (const item of missingStoreSymbols) {
      console.error(`- ${item}`);
    }
  }

  process.exit(1);
}

console.log('✅ App icon audit passed: all app HTML and store entries include icon metadata.');