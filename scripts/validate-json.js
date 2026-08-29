'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const ignoredDirectories = new Set(['.git', 'node_modules', 'coverage']);
const jsonFiles = [];

function collectJsonFiles(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) continue;

    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) collectJsonFiles(entryPath);
    if (entry.isFile() && entry.name.endsWith('.json')) jsonFiles.push(entryPath);
  }
}

collectJsonFiles(root);

for (const file of jsonFiles) {
  try {
    JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    console.error(`JSON invalido: ${path.relative(root, file)}: ${error.message}`);
    process.exitCode = 1;
  }
}

if (!process.exitCode) {
  console.log(`JSON valido: ${jsonFiles.length} archivo(s)`);
}
