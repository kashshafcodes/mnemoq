import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

// The motion audit (sensory spec 4.3): only transform and opacity move.
// Keyframes may animate nothing else. Transitions may also change paint-only
// properties on one small control (colour, background, border colour, shadow)
// and the stroke of an SVG ring (120 px at most), the spec's listed exceptions.
// Anything that moves layout (width, height, top, margin...) or repaints a
// large area every frame (background-position shimmer, filter) fails here.

const ROOT = join(import.meta.dirname, '..', 'src');
const KEYFRAME_OK = new Set(['transform', 'opacity', 'animation-timing-function']);
const TRANSITION_OK = new Set([
  'transform',
  'opacity',
  'color',
  'background',
  'background-color',
  'border-color',
  'outline-color',
  'box-shadow',
  'fill',
  'stroke',
  'stroke-dashoffset',
  'stroke-dasharray',
  'text-decoration-color',
  'none',
]);

function cssFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);

    if (statSync(path).isDirectory()) return cssFiles(path);
    return path.endsWith('.css') ? [path] : [];
  });
}

// Comments become blank lines so line numbers stay right.
function load(path) {
  return readFileSync(path, 'utf8').replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, ' '));
}

const lineOf = (css, index) => css.slice(0, index).split('\n').length;

// Split on commas outside brackets: "transform 1s cubic-bezier(.3,1,.5,1), opacity 1s".
function splitTop(value) {
  const parts = [];
  let depth = 0;
  let start = 0;

  for (let i = 0; i < value.length; i += 1) {
    if (value[i] === '(') depth += 1;
    else if (value[i] === ')') depth -= 1;
    else if (value[i] === ',' && depth === 0) {
      parts.push(value.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(value.slice(start));
  return parts.map((part) => part.trim()).filter(Boolean);
}

export function auditCss(css, file = 'inline.css') {
  const problems = [];
  const keyframes = /@keyframes\s+([\w-]+)\s*\{/g;
  let match;

  while ((match = keyframes.exec(css))) {
    let i = match.index + match[0].length;
    let depth = 1;
    const start = i;

    while (depth && i < css.length) {
      if (css[i] === '{') depth += 1;
      else if (css[i] === '}') depth -= 1;
      i += 1;
    }
    const body = css.slice(start, i - 1);
    const props = [...body.matchAll(/([a-z-]+)\s*:/g)].map((m) => m[1]).filter((p) => !KEYFRAME_OK.has(p));

    for (const prop of new Set(props)) {
      problems.push(`${file}:${lineOf(css, match.index)} @keyframes ${match[1]} animates ${prop}`);
    }
  }

  for (const m of css.matchAll(/(?<![\w-])transition(-property)?\s*:\s*([^;}]+)/g)) {
    const props = splitTop(m[2]).map((part) => (m[1] ? part : part.split(/\s+/)[0]));

    for (const prop of props) {
      if (!TRANSITION_OK.has(prop) && !prop.startsWith('var(')) {
        problems.push(`${file}:${lineOf(css, m.index)} transition on ${prop}`);
      }
    }
  }
  return problems;
}

describe('motion audit: only transform and opacity move', () => {
  it('flags layout, filter and shimmer animation', () => {
    expect(auditCss('@keyframes a { from { width: 0 } }')).toHaveLength(1);
    expect(auditCss('@keyframes s { to { background-position: -200% 0 } }')).toHaveLength(1);
    expect(auditCss('.x { transition: width .3s ease; }')).toHaveLength(1);
    expect(auditCss('.x { transition: all .3s; }')).toHaveLength(1);
    expect(auditCss('.x { transition: transform .1s, filter .2s; }')).toEqual(['inline.css:1 transition on filter']);
    expect(auditCss('.x { transition-property: height; }')).toHaveLength(1);
  });

  it('allows transform, opacity and the spec exceptions', () => {
    expect(auditCss('@keyframes p { 0% { transform: scale(.9); opacity: 0 } }')).toEqual([]);
    expect(auditCss('.x { transition: transform 1s cubic-bezier(.3,1.6,.5,1), opacity 1s; }')).toEqual([]);
    expect(auditCss('.b { transition: background-color 150ms, color 150ms, box-shadow 150ms; }')).toEqual([]);
    expect(auditCss('.r { transition: stroke-dashoffset var(--dur-3) var(--ease-out); }')).toEqual([]);
    expect(auditCss('.z { transition: none; animation-transition: x; }')).toEqual([]);
  });

  it('every CSS file in src passes', () => {
    const problems = cssFiles(ROOT).flatMap((path) =>
      auditCss(load(path), relative(ROOT, path).replace(/\\/g, '/')),
    );

    expect(problems).toEqual([]);
  });
});
