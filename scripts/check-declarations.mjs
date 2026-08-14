/**
 * The build resolves tsconfig path aliases in the emitted JavaScript but not in
 * the emitted declarations, so an alias that reaches a .d.ts leaves consumers
 * with `any` instead of the real type — no error, just silently unchecked code.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ALIAS_IMPORT = /from '(@types|@utils|@contexts|@components|@hooks)[^']*'/;

// Grandfathered. Fixing these widens the types consumers see, which breaks their
// builds where a mismatch was previously masked, so it needs its own release.
const KNOWN_LEAKS = [
  'components/shared/search-bar.d.ts',
  'contexts/document-viewer-context.d.ts',
  'hooks/use-document-search.d.ts',
  'utils/document-processing.d.ts'
];

const declarations = (directory, prefix = '') =>
  readdirSync(directory).flatMap(entry => {
    const path = join(directory, entry);
    const relative = prefix ? `${prefix}/${entry}` : entry;
    if (statSync(path).isDirectory()) return declarations(path, relative);
    return relative.endsWith('.d.ts') ? [{ path, relative }] : [];
  });

const leaking = declarations('dist')
  .filter(({ path }) => ALIAS_IMPORT.test(readFileSync(path, 'utf8')))
  .map(({ relative }) => relative);

const introduced = leaking.filter(relative => !KNOWN_LEAKS.includes(relative));
const fixed = KNOWN_LEAKS.filter(relative => !leaking.includes(relative));

if (introduced.length > 0) {
  console.error('Unresolved path aliases in emitted declarations:');
  for (const relative of introduced) console.error(`  dist/${relative}`);
  console.error('Import these with a relative path — an alias degrades the type to any.');
  process.exit(1);
}

if (fixed.length > 0) {
  console.error('These no longer leak; drop them from KNOWN_LEAKS so the check keeps its teeth:');
  for (const relative of fixed) console.error(`  dist/${relative}`);
  process.exit(1);
}

console.log(`declarations: OK — ${leaking.length} known leak(s), none introduced.`);
