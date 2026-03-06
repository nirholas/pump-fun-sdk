#!/usr/bin/env node
// Audit: check store DB integrity
const fs = require('fs');
const path = require('path');

const osDir = path.join(__dirname, '..');
const db = JSON.parse(fs.readFileSync(path.join(osDir, 'Pump-Store/db/v2.json'), 'utf8'));
const apps = db.apps;

// Check all app.src references point to existing files
const missing = [];
for (const a of apps) {
  const filePath = path.join(osDir, a.src);
  if (fs.existsSync(filePath) === false) {
    missing.push(a.id + ' -> ' + a.src);
  }
}
console.log('Total apps in DB:', apps.length);
console.log('Missing files:', missing.length);
missing.forEach(m => console.log('  MISSING:', m));

// Check for apps on disk not in DB
const diskApps = fs.readdirSync(path.join(osDir, 'Pump-Store/apps'))
  .filter(f => f.endsWith('.html'))
  .map(f => f.replace('.html', ''));
const dbIds = new Set(apps.map(a => a.id));
const orphans = diskApps.filter(d => dbIds.has(d) === false);
console.log('\nDisk apps not in DB:', orphans.length);
orphans.forEach(o => console.log('  ORPHAN:', o));

// Check for duplicate names in DB
const nameCounts = {};
for (const a of apps) {
  const lower = a.name.toLowerCase();
  nameCounts[lower] = (nameCounts[lower] || []);
  nameCounts[lower].push(a.id);
}
const dupeNames = Object.entries(nameCounts).filter(([,v]) => v.length > 1);
console.log('\nDuplicate names in DB:', dupeNames.length);
dupeNames.forEach(([name, ids]) => console.log(`  "${name}": ${ids.join(', ')}`));
