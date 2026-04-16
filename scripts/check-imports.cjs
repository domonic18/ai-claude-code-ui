#!/usr/bin/env node
/**
 * Import Resolution Checker
 *
 * Scans all backend .js files and verifies that every relative import
 * resolves to an existing file on disk. Catches broken paths that
 * only surface at runtime in ESM.
 *
 * Run: npm run test:imports
 * CI:  Called automatically in test:ci
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const BACKEND = path.join(ROOT, 'backend');

/**
 * Recursively find all .js files under a directory
 */
function findJsFiles(dir) {
  const results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      // Skip node_modules and __tests__
      if (entry.name === 'node_modules' || entry.name === '__tests__') continue;
      results.push(...findJsFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      results.push(fullPath);
    }
  }
  return results;
}

const files = findJsFiles(BACKEND);
let errors = 0;
let checked = 0;

for (const filePath of files) {
  const dir = path.dirname(filePath);
  const content = fs.readFileSync(filePath, 'utf8');
  // Match relative imports: from '../...' or from './...'
  const importRegex = /from\s+['"](\.{1,2}\/[^'"]+)['"]/g;
  let match;

  while ((match = importRegex.exec(content)) !== null) {
    const importPath = match[1];
    const resolved = path.resolve(dir, importPath);
    const exists = fs.existsSync(resolved);
    checked++;

    if (!exists) {
      const relative = path.relative(ROOT, filePath);
      console.log('MISSING:', relative, '|', importPath, '->', path.relative(ROOT, resolved));
      errors++;
    }
  }
}

console.log(`Checked ${checked} relative imports across ${files.length} files.`);

if (errors === 0) {
  console.log('All relative imports resolve correctly!');
} else {
  console.log('Found', errors, 'broken import(s)');
  process.exit(1);
}
