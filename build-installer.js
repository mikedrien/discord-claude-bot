#!/usr/bin/env node

/**
 * Builds a self-contained installer by:
 * 1. Reading all project source files
 * 2. Embedding them as base64 in the installer script
 * 3. Building an EXE from the result using pkg
 *
 * The resulting EXE, when run:
 * - Asks where to install
 * - Extracts all project files
 * - Checks/installs Node.js, Claude CLI, npm deps
 * - Walks through Discord bot setup
 * - Writes .env + config.json
 * - Offers to start the bot
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = __dirname;
const DIST = path.join(ROOT, 'dist');

// Files to embed in the installer
const FILES_TO_EMBED = [
  'package.json',
  '.env.example',
  '.gitignore',
  'config.example.json',
  'src/index.js',
  'src/commands.js',
  'src/messageHandler.js',
  'src/sessionManager.js',
  'src/config.js',
  'src/logger.js',
];

console.log('Building self-contained installer...\n');

// Read and encode all files
const embedded = {};
for (const file of FILES_TO_EMBED) {
  const fullPath = path.join(ROOT, file);
  const content = fs.readFileSync(fullPath, 'utf-8');
  embedded[file] = Buffer.from(content).toString('base64');
  console.log(`  Embedded: ${file} (${content.length} bytes)`);
}

// Read the installer template
const installerTemplate = fs.readFileSync(path.join(ROOT, 'installer.js'), 'utf-8');

// Replace the placeholder with actual data
const finalInstaller = installerTemplate.replace(
  "'__EMBEDDED_FILES_PLACEHOLDER__'",
  JSON.stringify(embedded)
);

// Write the final installer
fs.mkdirSync(DIST, { recursive: true });
const outputJs = path.join(DIST, 'installer-bundle.js');
fs.writeFileSync(outputJs, finalInstaller, 'utf-8');
console.log(`\n  Written: ${outputJs}`);

// Build EXE
console.log('\n  Building EXE (this may take a moment)...\n');
try {
  execSync(
    `npx pkg "${outputJs}" --target node18-win-x64 --output "${path.join(DIST, 'discord-claude-setup.exe')}"`,
    { cwd: ROOT, stdio: 'inherit' }
  );
  console.log('\n  ✓ EXE built: dist/discord-claude-setup.exe');
} catch (err) {
  console.error('\n  ✗ EXE build failed:', err.message);
  process.exit(1);
}

// Keep bundle for testing
console.log(`  Bundle kept at: ${outputJs} (for testing)`);
console.log('Done! Distribute: dist/discord-claude-setup.exe');
