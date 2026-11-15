import katex from 'katex';
import 'katex/dist/katex.min.css';
import { Fragment, useMemo } from 'react';
import Graph from './Graph';

// Card text with maths and graphs:
//   $x^2 + 3x$  or  \(x^2\)        a formula in the line
//   $$\frac{a}{b}$$  or  \[ ... \]  a formula on its own line
//   [graph: y = a*sin(x)]          an interactive graph with sliders
// Anything else stays plain text. KaTeX escapes everything it renders and runs
// with trust off, so card text cannot inject HTML or scripts.

const PATTERN = /\[graph:\s*((?:[^[\]]|\[[^[\]]*\]){1,300})\]|\$\$([^$]{1,600}?)\$\$|\\\[([\s\S]{1,600}?)\\\]|\\\(([^\n]{1,300}?)\\\)|\$(?=\S)([^$\n]{1,300}?)(?<=\S)\$/g;

export const hasRich = (text) => /\$|\\\(|\\\[|\[graph:/.test(String(text || ''));

function tex(source, display) {
  try {
    return katex.renderToString(source, {
      displayMode: display,
      throwOnError: false,
      trust: false,
      strict: 'ignore',
      maxSize: 20,
      maxExpand: 200,
      output: 'htmlAndMathml',
    });
  } catch {
    return null;
  }
}

export function splitRich(text) {
  const src = String(text ?? '');
  const parts = [];
  let last = 0;

  for (const m of src.matchAll(PATTERN)) {
    // "$5 and $10" is money, not maths: skip a $...$ that is only numbers and words.
    if (m[5] !== undefined && /^[\d.,]+\b/.test(m[5]) && !/[\\^_{}=+*/]/.test(m[5])) continue;

    if (m.index > last) parts.push({ type: 'text', value: src.slice(last, m.index) });

    if (m[1] !== undefined) parts.push({ type: 'graph', value: m[1].trim() });
    else if (m[2] !== undefined || m[3] !== undefined) parts.push({ type: 'math', display: true, value: (m[2] ?? m[3]).trim() });
    else parts.push({ type: 'math', display: false, value: (m[4] ?? m[5]).trim() });

    last = m.index + m[0].length;
  }

  if (last < src.length) parts.push({ type: 'text', value: src.slice(last) });

  return parts;
}

export default function RichText({ text, graphs = true }) {
  const parts = useMemo(() => (hasRich(text) ? splitRich(text) : null), [text]);

  if (!parts) return text ?? null;

  return parts.map((part, i) => {
    if (part.type === 'text') return <Fragment key={i}>{part.value}</Fragment>;

    if (part.type === 'graph') return graphs ? <Graph key={i} spec={part.value} /> : <Fragment key={i}>(graph)</Fragment>;

    const html = tex(part.value, part.display);

    return html ? (
      <span
        key={i}
        className={part.display ? 'rich-math rich-math-block' : 'rich-math'}
        // KaTeX output, with trust off: safe to insert.
        dangerouslySetInnerHTML={{ __html: html }}
      />
    ) : (
      <Fragment key={i}>{part.value}</Fragment>
    );
  });
}
