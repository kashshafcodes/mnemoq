// A small, safe reader for formulas typed in cards, for interactive graphs:
//   "a*x^2 + 3x - sin(2x)"  ->  (vars) => number
// No eval and no access to anything but numbers and the maths functions below,
// so a card can never run code. Pure functions, easy to test.

const FUNCTIONS = {
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
  asin: Math.asin,
  acos: Math.acos,
  atan: Math.atan,
  sinh: Math.sinh,
  cosh: Math.cosh,
  tanh: Math.tanh,
  sqrt: Math.sqrt,
  cbrt: Math.cbrt,
  abs: Math.abs,
  ln: Math.log,
  log: Math.log10,
  exp: Math.exp,
  floor: Math.floor,
  ceil: Math.ceil,
  round: Math.round,
  sign: Math.sign,
};

const CONSTANTS = { pi: Math.PI, π: Math.PI, e: Math.E };

export const MAX_LENGTH = 200;

function tokenize(text) {
  const tokens = [];
  const src = String(text).replace(/\s+/g, '').replace(/[×·]/g, '*').replace(/[÷]/g, '/').replace(/[−–]/g, '-');
  let i = 0;

  while (i < src.length) {
    const rest = src.slice(i);
    const num = /^(\d+\.?\d*|\.\d+)(e[+-]?\d+)?/i.exec(rest);
    const word = /^[a-zA-Zπ_][a-zA-Z0-9_]*/.exec(rest);

    if (num) {
      tokens.push({ type: 'num', value: Number(num[0]) });
      i += num[0].length;
    } else if (word) {
      // Split words that are not functions or constants into single letters: "ax" = a*x.
      let w = word[0];

      if (!FUNCTIONS[w] && !(w in CONSTANTS) && !/_/.test(w)) {
        const fn = Object.keys(FUNCTIONS)
          .sort((a, b) => b.length - a.length)
          .find((f) => w.endsWith(f) && w.length > f.length);

        if (fn) {
          for (const ch of w.slice(0, -fn.length)) tokens.push({ type: 'name', value: ch });
          w = fn;
        } else if (w.length > 1) {
          for (const ch of w) tokens.push({ type: 'name', value: ch });
          i += word[0].length;
          continue;
        }
      }

      tokens.push({ type: 'name', value: w });
      i += word[0].length;
    } else if ('+-*/^(),'.includes(src[i])) {
      tokens.push({ type: 'op', value: src[i] });
      i += 1;
    } else {
      throw new Error(`Unexpected "${src[i]}"`);
    }
  }

  // Implicit multiplication: 2x, 3(x+1), (x+1)(x-1), x(2), 2sin(x)
  const out = [];

  for (const t of tokens) {
    const prev = out[out.length - 1];
    const prevEnds = prev && (prev.type === 'num' || (prev.type === 'name' && !FUNCTIONS[prev.value]) || prev.value === ')');
    const startsValue = t.type === 'num' || t.type === 'name' || t.value === '(';

    if (prevEnds && startsValue) out.push({ type: 'op', value: '*' });
    out.push(t);
  }

  return out;
}

// Recursive descent: expr = term (+|- term)*, term = unary (*|/ unary)*,
// unary = -unary | power, power = atom (^ unary)?, atom = number | name | f(args) | (expr)
function parse(tokens) {
  let pos = 0;
  const peek = () => tokens[pos];
  const take = (value) => {
    const t = tokens[pos];

    if (!t || (value && t.value !== value)) throw new Error(value ? `Expected "${value}"` : 'Unexpected end');
    pos += 1;
    return t;
  };

  function expr() {
    let node = term();

    while (peek() && (peek().value === '+' || peek().value === '-')) {
      const op = take().value;
      const right = term();
      const left = node;

      node = op === '+' ? (v) => left(v) + right(v) : (v) => left(v) - right(v);
    }

    return node;
  }

  function term() {
    let node = unary();

    while (peek() && (peek().value === '*' || peek().value === '/')) {
      const op = take().value;
      const right = unary();
      const left = node;

      node = op === '*' ? (v) => left(v) * right(v) : (v) => left(v) / right(v);
    }

    return node;
  }

  function unary() {
    if (peek() && peek().value === '-') {
      take();
      const inner = unary();

      return (v) => -inner(v);
    }

    if (peek() && peek().value === '+') {
      take();
      return unary();
    }

    return power();
  }

  function power() {
    const base = atom();

    if (peek() && peek().value === '^') {
      take();
      const exponent = unary();

      return (v) => base(v) ** exponent(v);
    }

    return base;
  }

  function atom() {
    const t = take();

    if (t.type === 'num') return () => t.value;

    if (t.type === 'name') {
      if (FUNCTIONS[t.value]) {
        const fn = FUNCTIONS[t.value];

        take('(');
        const arg = expr();
        take(')');

        return (v) => fn(arg(v));
      }

      if (t.value in CONSTANTS) return () => CONSTANTS[t.value];

      const name = t.value;

      return (v) => (Object.prototype.hasOwnProperty.call(v, name) ? v[name] : NaN);
    }

    if (t.value === '(') {
      const inner = expr();

      take(')');
      return inner;
    }

    throw new Error(`Unexpected "${t.value}"`);
  }

  const result = expr();

  if (pos < tokens.length) throw new Error(`Unexpected "${tokens[pos].value}"`);

  return result;
}

// The letters a formula uses (other than functions and constants).
export function variablesOf(text) {
  const names = new Set();

  for (const t of tokenize(text)) {
    if (t.type === 'name' && !FUNCTIONS[t.value] && !(t.value in CONSTANTS)) names.add(t.value);
  }

  return [...names];
}

// -> { fn, vars } or { error }
export function compile(text) {
  if (!text || String(text).length > MAX_LENGTH) return { error: 'Formula is empty or too long.' };

  try {
    const fn = parse(tokenize(text));

    return { fn, vars: variablesOf(text) };
  } catch (error) {
    return { error: error.message };
  }
}

// Reads a graph block: "y = a*x^2 + b | y = 2x; a = 1 [-5, 5]; b = 0; x = -10..10"
// -> { curves: [{ label, fn }], params: [{ name, value, min, max }], x: [min, max], xName } or { error }
export function parseGraph(spec) {
  const parts = String(spec || '')
    .split(';')
    .map((p) => p.trim())
    .filter(Boolean);

  if (parts.length === 0) return { error: 'Nothing to draw.' };

  const curves = [];
  const declared = {};
  let xRange = null;
  let xName = 'x';

  for (const rawCurve of parts[0].split('|')) {
    const text = rawCurve.trim();
    const eq = /^([a-zA-Z][a-zA-Z0-9]*)\s*\(?\s*([a-zA-Z]?)\s*\)?\s*=\s*(.+)$/.exec(text);
    const body = eq ? eq[3] : text;
    const compiled = compile(body);

    if (compiled.error) return { error: `${text}: ${compiled.error}` };

    curves.push({ label: eq ? `${eq[1]} = ${body}` : `y = ${body}`, fn: compiled.fn, vars: compiled.vars });

    if (eq && eq[2]) xName = eq[2];
  }

  for (const part of parts.slice(1)) {
    const range = /^([a-zA-Z])\s*=\s*(-?[\d.]+)\s*\.\.\s*(-?[\d.]+)$/.exec(part);
    const param = /^([a-zA-Z][a-zA-Z0-9]*)\s*=\s*(-?[\d.]+)\s*(?:\[\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*\])?$/.exec(part);

    if (range) {
      xName = range[1];
      xRange = [Number(range[2]), Number(range[3])].sort((a, b) => a - b);
    } else if (param) {
      const value = Number(param[2]);
      const span = Math.max(1, Math.abs(value) * 2);

      declared[param[1]] = {
        name: param[1],
        value,
        min: param[3] !== undefined ? Number(param[3]) : value - span,
        max: param[4] !== undefined ? Number(param[4]) : value + span,
      };
    }
  }

  // Any other letter used in a formula becomes a slider starting at 1.
  for (const curve of curves) {
    for (const name of curve.vars) {
      if (name !== xName && !declared[name]) declared[name] = { name, value: 1, min: -5, max: 5 };
    }
  }

  return { curves, params: Object.values(declared), x: xRange || [-10, 10], xName };
}
