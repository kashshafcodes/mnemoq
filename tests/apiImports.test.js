import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// Vercel runs api/*.js in plain Node ESM, which needs exact file paths
// ("./rules.js", not "./rules"). Vite and Vitest forgive a missing ending, so
// a bad import passes every other test and only crashes the live function
// (wave 3d-2's /api/referral returned FUNCTION_INVOCATION_FAILED for this).
const IMPORT = /(?:import|export)[^'"]*?from\s*['"](\.[^'"]+)['"]|import\(\s*['"](\.[^'"]+)['"]\s*\)/g;

function badImports() {
  const seen = new Set();
  const bad = [];

  const walk = (file) => {
    if (seen.has(file)) return;
    seen.add(file);

    for (const m of readFileSync(file, 'utf8').matchAll(IMPORT)) {
      const spec = m[1] || m[2];
      const target = resolve(dirname(file), spec);

      if (!existsSync(target) || statSync(target).isDirectory()) bad.push(`${file} -> ${spec}`);
      else walk(target);
    }
  };

  for (const f of readdirSync('api')) if (f.endsWith('.js')) walk(resolve('api', f));

  return bad;
}

describe('api imports', () => {
  it('every relative import reachable from api/ names an exact file', () => {
    expect(badImports()).toEqual([]);
  });
});
