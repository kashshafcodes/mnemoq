import { useId, useMemo, useRef, useState } from 'react';
import { parseGraph } from '../mathExpr';

// An interactive graph from a card: "[graph: y = a*x^2 + b; a = 1 [-3, 3]]".
// Every letter other than x gets a slider; touching or hovering the graph
// shows the values at that point. Drawn in SVG with theme colours.

const W = 600;
const H = 340;
const PAD = { l: 44, r: 16, t: 14, b: 30 };
const COLORS = ['var(--accent)', 'var(--highlight)', 'var(--success)', 'var(--danger)'];

function niceStep(span) {
  const raw = span / 6;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const n = raw / pow;

  return (n < 1.5 ? 1 : n < 3.5 ? 2 : n < 7.5 ? 5 : 10) * pow;
}

const fmt = (v) => (Math.abs(v) >= 1000 || (Math.abs(v) < 0.01 && v !== 0) ? v.toExponential(1) : String(Math.round(v * 100) / 100));

export default function Graph({ spec }) {
  const graph = useMemo(() => parseGraph(spec), [spec]);
  const [values, setValues] = useState(() => Object.fromEntries((graph.params || []).map((p) => [p.name, p.value])));
  const [hover, setHover] = useState(null);
  const svgRef = useRef(null);
  const clipId = `graph-clip-${useId().replace(/[^a-zA-Z0-9-]/g, '')}`;

  const plot = useMemo(() => {
    if (graph.error) return null;

    const [x0, x1] = graph.x;
    const steps = 240;
    const lines = graph.curves.map((curve) => {
      const pts = [];

      for (let i = 0; i <= steps; i += 1) {
        const x = x0 + ((x1 - x0) * i) / steps;
        const y = curve.fn({ ...values, [graph.xName]: x });

        pts.push([x, Number.isFinite(y) ? y : null]);
      }

      return pts;
    });

    // y range from the values, ignoring the extreme 2% so asymptotes do not flatten everything.
    const ys = lines
      .flat()
      .map((p) => p[1])
      .filter((y) => y !== null)
      .sort((a, b) => a - b);

    if (ys.length === 0) return { lines, y: [-1, 1], x: [x0, x1] };

    let lo = ys[Math.floor(ys.length * 0.02)];
    let hi = ys[Math.ceil(ys.length * 0.98) - 1];

    if (lo === hi) {
      lo -= 1;
      hi += 1;
    }

    const margin = (hi - lo) * 0.08;

    return { lines, y: [lo - margin, hi + margin], x: [x0, x1] };
  }, [graph, values]);

  if (graph.error) return <p className="graph-error">Graph: {graph.error}</p>;

  const sx = (x) => PAD.l + ((x - plot.x[0]) / (plot.x[1] - plot.x[0])) * (W - PAD.l - PAD.r);
  const sy = (y) => H - PAD.b - ((y - plot.y[0]) / (plot.y[1] - plot.y[0])) * (H - PAD.t - PAD.b);
  const xStep = niceStep(plot.x[1] - plot.x[0]);
  const yStep = niceStep(plot.y[1] - plot.y[0]);
  const ticks = (lo, hi, step) => {
    const out = [];

    for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) out.push(Math.abs(v) < step / 1e6 ? 0 : v);

    return out;
  };

  const pathOf = (pts) => {
    let d = '';
    let pen = false;

    for (const [x, y] of pts) {
      if (y === null || y < plot.y[0] - (plot.y[1] - plot.y[0]) * 2 || y > plot.y[1] + (plot.y[1] - plot.y[0]) * 2) {
        pen = false;
        continue;
      }

      d += `${pen ? 'L' : 'M'}${sx(x).toFixed(1)},${sy(y).toFixed(1)}`;
      pen = true;
    }

    return d;
  };

  function track(event) {
    const svg = svgRef.current;

    if (!svg) return;

    const rect = svg.getBoundingClientRect();
    const point = event.touches ? event.touches[0] : event;
    const px = ((point.clientX - rect.left) / rect.width) * W;
    const x = plot.x[0] + ((px - PAD.l) / (W - PAD.l - PAD.r)) * (plot.x[1] - plot.x[0]);

    if (x < plot.x[0] || x > plot.x[1]) {
      setHover(null);
      return;
    }

    setHover({ x, ys: graph.curves.map((c) => c.fn({ ...values, [graph.xName]: x })) });
  }

  return (
    <figure className="graph">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`Graph of ${graph.curves.map((c) => c.label).join(' and ')}`}
        onMouseMove={track}
        onTouchMove={track}
        onTouchStart={track}
        onMouseLeave={() => setHover(null)}
      >
        <clipPath id={clipId}>
          <rect x={PAD.l} y={PAD.t} width={W - PAD.l - PAD.r} height={H - PAD.t - PAD.b} />
        </clipPath>
        {ticks(plot.x[0], plot.x[1], xStep).map((v) => (
          <g key={`x${v}`}>
            <line className="graph-grid" x1={sx(v)} x2={sx(v)} y1={PAD.t} y2={H - PAD.b} />
            <text className="graph-tick" x={sx(v)} y={H - PAD.b + 18} textAnchor="middle">
              {fmt(v)}
            </text>
          </g>
        ))}
        {ticks(plot.y[0], plot.y[1], yStep).map((v) => (
          <g key={`y${v}`}>
            <line className="graph-grid" x1={PAD.l} x2={W - PAD.r} y1={sy(v)} y2={sy(v)} />
            <text className="graph-tick" x={PAD.l - 6} y={sy(v) + 4} textAnchor="end">
              {fmt(v)}
            </text>
          </g>
        ))}
        {plot.y[0] < 0 && plot.y[1] > 0 && <line className="graph-axis" x1={PAD.l} x2={W - PAD.r} y1={sy(0)} y2={sy(0)} />}
        {plot.x[0] < 0 && plot.x[1] > 0 && <line className="graph-axis" x1={sx(0)} x2={sx(0)} y1={PAD.t} y2={H - PAD.b} />}
        <g clipPath={`url(#${clipId})`}>
          {plot.lines.map((pts, i) => (
            <path key={graph.curves[i].label} d={pathOf(pts)} className="graph-line" style={{ stroke: COLORS[i % COLORS.length] }} />
          ))}
          {hover && <line className="graph-hover" x1={sx(hover.x)} x2={sx(hover.x)} y1={PAD.t} y2={H - PAD.b} />}
          {hover &&
            hover.ys.map((y, i) =>
              Number.isFinite(y) ? <circle key={i} cx={sx(hover.x)} cy={sy(y)} r="5" style={{ fill: COLORS[i % COLORS.length] }} /> : null
            )}
        </g>
      </svg>

      <figcaption>
        <div className="graph-legend">
          {graph.curves.map((c, i) => (
            <span key={c.label}>
              <i style={{ background: COLORS[i % COLORS.length] }} />
              {c.label}
            </span>
          ))}
        </div>
        <p className="graph-readout" aria-live="polite">
          {hover
            ? `${graph.xName} = ${fmt(hover.x)}` + hover.ys.map((y, i) => ` · ${graph.curves.length > 1 ? `#${i + 1} ` : ''}y = ${Number.isFinite(y) ? fmt(y) : '–'}`).join('')
            : 'Move over the graph to read values.'}
        </p>
        {graph.params.length > 0 && (
          <div className="graph-sliders">
            {graph.params.map((p) => (
              <label key={p.name}>
                <span>
                  {p.name} = <b>{fmt(values[p.name])}</b>
                </span>
                <input
                  type="range"
                  min={p.min}
                  max={p.max}
                  step={(p.max - p.min) / 200}
                  value={values[p.name]}
                  onChange={(e) => setValues((v) => ({ ...v, [p.name]: Number(e.target.value) }))}
                />
              </label>
            ))}
          </div>
        )}
      </figcaption>
    </figure>
  );
}
