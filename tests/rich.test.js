import { describe, expect, it } from 'vitest';
import { compile, parseGraph } from '../src/mathExpr.js';
import { splitRich } from '../src/components/RichText.jsx';

describe('formula reader', () => {
  const at = (text, vars = {}) => compile(text).fn(vars);

  it('understands normal school notation', () => {
    expect(at('2x^2+3x-1', { x: 2 })).toBe(13);
    expect(at('(x+1)(x-1)', { x: 3 })).toBe(8);
    expect(at('2sin(pi/2)')).toBe(2);
    expect(at('-x^2', { x: 3 })).toBe(-9);
  });

  it('cannot reach anything but maths', () => {
    expect(compile('constructor').error).toBeTruthy();
    expect(compile('x;alert(1)').error).toBeTruthy();
    expect(Number.isNaN(at('q', { x: 1 }))).toBe(true);
    expect(compile('x'.repeat(500)).error).toBeTruthy();
  });

  it('turns letters into sliders with ranges', () => {
    const g = parseGraph('y = a*x^2 + b; a = 2 [0, 5]; x = -3..3');

    expect(g.params).toEqual([
      { name: 'a', value: 2, min: 0, max: 5 },
      { name: 'b', value: 1, min: -5, max: 5 },
    ]);
    expect(g.x).toEqual([-3, 3]);
  });
});

describe('card text', () => {
  it('finds formulas and graphs, including slider ranges in brackets', () => {
    const parts = splitRich('Speed $v$ and [graph: y = v*x; v = 20 [5, 40]] done');

    expect(parts.map((p) => p.type)).toEqual(['text', 'math', 'text', 'graph', 'text']);
    expect(parts[3].value).toBe('y = v*x; v = 20 [5, 40]');
  });

  it('leaves money alone', () => {
    expect(splitRich('It costs $5 and $10 now').every((p) => p.type === 'text')).toBe(true);
  });
});
