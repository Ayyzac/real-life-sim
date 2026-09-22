// Enforces the hard rule from docs/ARCHITECTURE.md §1:
// nothing under src/core/ may import React or Phaser, so the whole simulation
// can be tested headlessly. Run locally via `npm run check:core-purity`; CI
// runs it too, so a violation can never reach the published site.
import { readFileSync } from 'node:fs';
import { glob } from 'node:fs/promises';

const BANNED = ['react', 'react-dom', 'phaser'];
const IMPORT_SOURCE = /(?:^|[\s;])(?:import|export)[\s\S]*?from\s*['"]([^'"]+)['"]|\bimport\s*\(\s*['"]([^'"]+)['"]/g;

const violations = [];

for await (const file of glob('src/core/**/*.{ts,tsx}')) {
  const source = readFileSync(file, 'utf8');
  for (const match of source.matchAll(IMPORT_SOURCE)) {
    const specifier = match[1] ?? match[2];
    if (!specifier) continue;
    const pkg = specifier.toLowerCase().split('/').slice(0, 2).join('/');
    if (BANNED.some((b) => pkg === b || pkg.startsWith(`${b}/`))) {
      violations.push(`${file}: imports "${specifier}"`);
    }
  }
}

if (violations.length > 0) {
  console.error('src/core must not import React or Phaser (docs/ARCHITECTURE.md §1):');
  for (const v of violations) console.error(`  - ${v}`);
  process.exit(1);
}

console.log('core purity OK: src/core imports no React or Phaser.');
