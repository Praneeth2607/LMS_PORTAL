// Small dependency-free charts for the admin analytics (SVG + HTML).
// Colours come from the --chart-* tokens in index.css (validated for
// colour-blind separation and contrast on the white panel surface).
import { useEffect, useId, useRef, useState } from 'react';

// Width of an element, kept up to date on resize.
function useWidth(ref) {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const update = () => setWidth(el.clientWidth);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);
  return width;
}

// Clean axis ticks from 0 to at least `max` (about four steps of 1/2/5 × 10^k).
export function niceTicks(max, target = 4) {
  if (!(max > 0)) return [0, 1, 2, 3, 4];
  const raw = max / target;
  const power = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((m) => m * power).find((s) => s >= raw);
  const top = Math.ceil(max / step) * step;
  const ticks = [];
  for (let v = 0; v <= top + step / 2; v += step) ticks.push(Math.round(v * 1000) / 1000);
  return ticks;
}

// ---------------------------------------------------------------- legend
export function Legend({ series }) {
  if (series.length < 2) return null;
  return (
    <ul className="flex flex-wrap gap-x-6 gap-y-2 text-[14px] text-charcoal">
      {series.map((s) => (
        <li key={s.key} className="flex items-center gap-2">
          <span className="h-0.5 w-4 rounded-full" style={{ background: s.color }} aria-hidden="true" />
          {s.label}
        </li>
      ))}
    </ul>
  );
}

// ---------------------------------------------------------------- line chart
// labels: x-axis labels (one per point). series: [{ key, label, color, values }].
// Hover or arrow keys move a crosshair; the tooltip lists every series.
export function LineChart({
  labels,
  series,
  yTicks,
  yFormat = (v) => String(v),
  valueFormat = yFormat,
  tooltipTitle = (i) => labels[i],
  tooltipExtra,
  directLabels = (s) => [s.values.length - 1],
  area = series.length === 1,
  height = 260,
  ariaLabel,
}) {
  const boxRef = useRef(null);
  const width = useWidth(boxRef);
  const [active, setActive] = useState(null);
  const n = labels.length;
  const max = Math.max(0, ...series.flatMap((s) => s.values.filter((v) => v !== null)));
  const ticks = yTicks || niceTicks(max);
  const top = ticks[ticks.length - 1] || 1;

  const m = { top: 16, right: 48, bottom: 34, left: 44 };
  const innerW = Math.max(0, width - m.left - m.right);
  const innerH = height - m.top - m.bottom;
  const x = (i) => m.left + (n <= 1 ? innerW / 2 : (i * innerW) / (n - 1));
  const y = (v) => m.top + innerH - (v / top) * innerH;
  const every = Math.max(1, Math.ceil(n / Math.max(1, Math.floor(innerW / 56))));

  const pick = (clientX) => {
    const rect = boxRef.current.getBoundingClientRect();
    const px = clientX - rect.left;
    const i = n <= 1 ? 0 : Math.round(((px - m.left) / innerW) * (n - 1));
    setActive(Math.max(0, Math.min(n - 1, i)));
  };
  const onKey = (e) => {
    const moves = { ArrowRight: 1, ArrowLeft: -1 };
    if (e.key in moves) {
      e.preventDefault();
      setActive((a) => Math.max(0, Math.min(n - 1, (a ?? -1) + moves[e.key])));
    } else if (e.key === 'Home') setActive(0);
    else if (e.key === 'End') setActive(n - 1);
    else if (e.key === 'Escape') setActive(null);
  };

  // End labels that would sit on top of each other are dropped (legend + tooltip carry them).
  const placed = [];
  const labelMarks = [];
  for (const s of series) {
    for (const i of directLabels(s)) {
      const v = s.values[i];
      if (v === null || v === undefined) continue;
      const ly = y(v);
      if (placed.some((p) => Math.abs(p.x - x(i)) < 40 && Math.abs(p.y - ly) < 16)) continue;
      placed.push({ x: x(i), y: ly });
      // End of the line: value to the right. Elsewhere above the point, or below
      // it when that is the lowest value or there is no room above.
      const end = i === n - 1;
      const isMin = v === Math.min(...s.values.filter((val) => val !== null));
      const below = !end && (isMin || ly - 12 < m.top + 4);
      labelMarks.push({
        key: `${s.key}-${i}`,
        x: end ? x(i) + 10 : x(i),
        y: end ? ly : below ? ly + 20 : ly - 12,
        anchor: end ? 'start' : 'middle',
        dy: end ? '0.32em' : undefined,
        text: valueFormat(v),
      });
    }
  }

  const tooltipLeft = active === null ? 0 : x(active);
  const flip = tooltipLeft > width - 200;

  return (
    <div ref={boxRef} className="relative select-none">
      {width > 0 && (
        <svg
          width={width}
          height={height}
          role="img"
          aria-label={ariaLabel}
          tabIndex={0}
          className="block rounded-[12px] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink"
          onPointerMove={(e) => pick(e.clientX)}
          onPointerDown={(e) => pick(e.clientX)}
          onPointerLeave={() => setActive(null)}
          onKeyDown={onKey}
          onFocus={() => setActive((a) => a ?? n - 1)}
          onBlur={() => setActive(null)}
        >
          {/* grid + y axis */}
          {ticks.map((t) => (
            <g key={t}>
              <line x1={m.left} x2={m.left + innerW} y1={y(t)} y2={y(t)} stroke={t === 0 ? 'var(--chart-axis)' : 'var(--chart-grid)'} strokeWidth="1" />
              <text x={m.left - 10} y={y(t)} dy="0.32em" textAnchor="end" className="fill-slate text-[12px] tabular-nums">
                {yFormat(t)}
              </text>
            </g>
          ))}
          {/* x labels */}
          {labels.map((label, i) =>
            (n - 1 - i) % every === 0 ? (
              <text key={i} x={x(i)} y={height - 10} textAnchor="middle" className="fill-slate text-[12px]">
                {label}
              </text>
            ) : null,
          )}
          {/* crosshair */}
          {active !== null && <line x1={x(active)} x2={x(active)} y1={m.top} y2={m.top + innerH} stroke="var(--chart-axis)" strokeWidth="1" />}
          {series.map((s) => {
            const pts = s.values.map((v, i) => (v === null ? null : [x(i), y(v)]));
            const drawn = pts.filter(Boolean);
            const d = drawn.map(([px, py], i) => `${i ? 'L' : 'M'}${px},${py}`).join(' ');
            return (
              <g key={s.key}>
                {area && drawn.length > 1 && (
                  <path
                    d={`${d} L${drawn[drawn.length - 1][0]},${y(0)} L${drawn[0][0]},${y(0)} Z`}
                    fill={s.color}
                    opacity="0.1"
                  />
                )}
                <path d={d} fill="none" stroke={s.color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
                {n <= 24 &&
                  pts.map((p, i) =>
                    p ? (
                      <circle key={i} cx={p[0]} cy={p[1]} r={active === i ? 5.5 : 4} fill={s.color} stroke="#fff" strokeWidth="2" />
                    ) : null,
                  )}
              </g>
            );
          })}
          {labelMarks.map((l) => (
            <text key={l.key} x={l.x} y={l.y} dy={l.dy} textAnchor={l.anchor} className="fill-ink text-[12px] font-medium tabular-nums">
              {l.text}
            </text>
          ))}
        </svg>
      )}
      {active !== null && width > 0 && (
        <div
          role="status"
          className="pointer-events-none absolute top-2 z-10 min-w-40 rounded-[16px] bg-white px-4 py-3 shadow-[0_8px_24px_rgba(20,20,19,0.14)]"
          style={flip ? { right: width - tooltipLeft + 12 } : { left: tooltipLeft + 12 }}
        >
          <p className="text-[13px] text-slate">{tooltipTitle(active)}</p>
          <ul className="mt-1.5 space-y-1">
            {series.map((s) => (
              <li key={s.key} className="flex items-center gap-2 text-[14px]">
                <span className="h-0.5 w-3 shrink-0 rounded-full" style={{ background: s.color }} aria-hidden="true" />
                <span className="font-semibold tabular-nums">{s.values[active] === null ? '–' : valueFormat(s.values[active])}</span>
                <span className="text-slate">{s.label}</span>
              </li>
            ))}
          </ul>
          {tooltipExtra && <p className="mt-1.5 text-[13px] text-slate">{tooltipExtra(active)}</p>}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- dot plot (1–5 scale)
// rows: [{ key, label, sublabel, value }]. The scale starts at `min`, not 0,
// because 1 is the lowest possible rating.
export function DotPlot({ rows, min = 1, max = 5, format = (v) => v.toFixed(1), ariaLabel }) {
  const ticks = [];
  for (let t = min; t <= max; t++) ticks.push(t);
  const pos = (v) => `${((v - min) / (max - min)) * 100}%`;
  return (
    <div role="list" aria-label={ariaLabel}>
      {rows.map((r) => (
        <div
          role="listitem"
          key={r.key}
          className="group grid gap-x-6 gap-y-2 border-b border-ink/10 py-4 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)_3.5rem] sm:items-center"
        >
          <div className="min-w-0">
            <p className="font-medium">{r.label}</p>
            {r.sublabel && <p className="text-[14px] text-slate">{r.sublabel}</p>}
          </div>
          <div className="relative h-8" aria-hidden="true">
            <div className="absolute inset-x-0 top-1/2 h-px bg-[var(--chart-axis)]" />
            {ticks.map((t) => (
              <div key={t} className="absolute top-1/2 h-2 w-px -translate-y-1/2 bg-[var(--chart-axis)]" style={{ left: pos(t) }} />
            ))}
            {r.value !== null && (
              <span
                className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-white transition-transform group-hover:scale-125"
                style={{ left: pos(r.value), background: 'var(--chart-1)' }}
              />
            )}
          </div>
          <p className="text-[20px] font-medium tabular-nums sm:text-right">
            {r.value === null ? '–' : format(r.value)}
            <span className="text-[14px] text-slate"> / {max}</span>
          </p>
        </div>
      ))}
      <div className="hidden gap-x-6 sm:grid sm:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)_3.5rem]" aria-hidden="true">
        <span />
        <div className="relative h-5 text-[12px] text-slate">
          {ticks.map((t) => (
            <span key={t} className="absolute -translate-x-1/2" style={{ left: pos(t) }}>
              {t}
            </span>
          ))}
        </div>
        <span />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- inline meter
export function Meter({ value, max = 100, label }) {
  const pct = value === null ? 0 : Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div
      className="h-1.5 w-full rounded-full bg-[var(--chart-1-track)]"
      role="meter"
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value ?? undefined}
      aria-label={label}
    >
      {value !== null && <div className="h-1.5 rounded-full bg-[var(--chart-1)]" style={{ width: `${pct}%` }} />}
    </div>
  );
}

// ---------------------------------------------------------------- data table view
// Every chart value stays reachable without hovering.
export function DataTable({ caption, columns, rows }) {
  const id = useId();
  return (
    <details className="mt-4 text-[14px]">
      <summary className="link cursor-pointer" aria-controls={id}>
        View as table
      </summary>
      <div id={id} className="mt-3 overflow-x-auto">
        <table className="w-full text-left">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr className="border-b border-ink/10 text-slate">
              {columns.map((c) => (
                <th key={c} scope="col" className="py-2 pr-4 font-medium">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-b border-ink/5">
                {r.map((cell, j) => (
                  <td key={j} className="py-2 pr-4 tabular-nums">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
