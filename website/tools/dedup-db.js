#!/usr/bin/env node
// One-time script: remove duplicate app entries from v2.json
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'Pump-Store', 'db', 'v2.json');
const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));

const toDelete = new Set([
  'correlation',
  'correlations',
  'fundingrates',
  'tokenunlocks',
  'unlocks',
  'positioncalc',
  'trade-journal',
  'tradejournal',
]);

const before = db.apps.length;
db.apps = db.apps.filter(a => !toDelete.has(a.id));
const after = db.apps.length;

fs.writeFileSync(dbPath, JSON.stringify(db, null, 6) + '\n');
console.log(`Removed ${before - after} entries. Before: ${before}, After: ${after}`);
