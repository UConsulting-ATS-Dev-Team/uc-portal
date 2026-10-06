import "../../styles/comms.css";

// A small dependency-free line chart. `days` is the list of x labels (YYYY-MM-DD); each series gives one value per day.
// Colors are passed as CSS variables so the chart follows light and dark mode.
export default function LineChart({ days, series, height = 260, label }) {
  const width = 820;
  const pad = { top: 16, right: 16, bottom: 28, left: 40 };
  const max = Math.max(1, ...series.flatMap((s) => s.values));
  const niceMax = Math.max(4, Math.ceil(max / 4) * 4);
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const x = (i) => pad.left + (days.length <= 1 ? innerW / 2 : (i / (days.length - 1)) * innerW);
  const y = (v) => pad.top + innerH - (v / niceMax) * innerH;
  const ticks = [0, 1, 2, 3, 4].map((t) => (niceMax / 4) * t);
  const step = Math.max(1, Math.ceil(days.length / 8));
  const fmt = (d) => new Date(`${d}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" });

  return (
    <figure className="chart">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.left} x2={width - pad.right} y1={y(t)} y2={y(t)} className="chart__grid" />
            <text x={pad.left - 8} y={y(t) + 4} textAnchor="end" className="chart__tick">
              {Math.round(t)}
            </text>
          </g>
        ))}
        {days.map((d, i) =>
          i % step === 0 ? (
            <text key={d} x={x(i)} y={height - 8} textAnchor="middle" className="chart__tick">
              {fmt(d)}
            </text>
          ) : null
        )}
        {series.map((s) => (
          <g key={s.name}>
            <polyline fill="none" stroke={s.color} strokeWidth="2" points={s.values.map((v, i) => `${x(i)},${y(v)}`).join(" ")} />
            {days.length <= 31 && s.values.map((v, i) => (v > 0 ? <circle key={i} cx={x(i)} cy={y(v)} r="2.5" fill={s.color} /> : null))}
          </g>
        ))}
      </svg>
      <figcaption className="chart__legend">
        {series.map((s) => (
          <span key={s.name}>
            <i style={{ background: s.color }} /> {s.name}
          </span>
        ))}
      </figcaption>
    </figure>
  );
}
