#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Read the batch file
const batchFile = 'sperax-agents-batch.json';
const agents = JSON.parse(fs.readFileSync(batchFile, 'utf8'));

// Create src directory if it doesn't exist
const srcDir = 'src';
if (!fs.existsSync(srcDir)) {
  fs.mkdirSync(srcDir, { recursive: true });
}

// Split each agent into its own file
let successCount = 0;
let errorCount = 0;

agents.forEach((agent) => {
  const filename = `${agent.identifier}.json`;
  const filepath = path.join(srcDir, filename);
  
  try {
    fs.writeFileSync(filepath, JSON.stringify(agent, null, 2));
    console.log(`✓ Created ${filename}`);
    successCount++;
  } catch (error) {
    console.error(`✗ Failed to create ${filename}:`, error.message);
    errorCount++;
  }
});

console.log(`\n✅ Successfully created ${successCount} agent files`);
if (errorCount > 0) {
  console.log(`❌ Failed to create ${errorCount} agent files`);
}
console.log(`\nAll agents are now in the ${srcDir}/ directory`);

