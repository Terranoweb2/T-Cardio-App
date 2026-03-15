'use client';

interface RiskGaugeProps {
  score: number;   // 0 – 100 percentage
  riskLevel: string; // FAIBLE | MODERE | ELEVE | CRITIQUE
}

// ---------------------------------------------------------------------------
// Color helpers
// ---------------------------------------------------------------------------
const LEVEL_META: Record<string, { label: string; color: string }> = {
  FAIBLE:   { label: 'FAIBLE',   color: '#22c55e' },
  MODERE:   { label: 'MODERE',   color: '#f59e0b' },
  ELEVE:    { label: 'ELEVE',    color: '#f97316' },
  CRITIQUE: { label: 'CRITIQUE', color: '#ef4444' },
};

function scoreColor(pct: number): string {
  if (pct <= 10) return '#22c55e';  // green
  if (pct <= 20) return '#f59e0b';  // yellow
  if (pct <= 30) return '#f97316';  // orange
  return '#ef4444';                  // red
}

// ---------------------------------------------------------------------------
// SVG geometry
// ---------------------------------------------------------------------------
const CX = 120;       // center x
const CY = 110;       // center y (shifted down a bit so arc is visually centered)
const R  = 90;         // radius
const STROKE = 14;     // arc thickness

// A semi-circle spans from 180 deg (left) to 0 deg (right) — that is pi to 0.
function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy - r * Math.sin(rad) };
}

function describeArc(
  cx: number, cy: number, r: number, startAngle: number, endAngle: number,
): string {
  const start = polarToCartesian(cx, cy, r, startAngle);
  const end   = polarToCartesian(cx, cy, r, endAngle);
  const largeArc = startAngle - endAngle > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y}`;
}

// Background arc: full semi-circle (180 -> 0)
const bgArc = describeArc(CX, CY, R, 180, 0);

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function RiskGauge({ score, riskLevel }: RiskGaugeProps) {
  const clamped = Math.max(0, Math.min(100, score));
  const meta = LEVEL_META[riskLevel] ?? LEVEL_META.FAIBLE;

  // Needle angle: score 0 -> 180 deg, score 100 -> 0 deg
  const needleAngle = 180 - (clamped / 100) * 180;
  const needleTip = polarToCartesian(CX, CY, R - STROKE / 2, needleAngle);

  // Value arc goes from 180 to the needle position
  const endAngle = Math.max(0.5, needleAngle); // avoid degenerate path at 0
  const valueArc = describeArc(CX, CY, R, 180, endAngle);

  // Color zone arcs (for the background gradient feel)
  const zones = [
    { from: 180, to: 162, color: '#22c55e' }, // 0-10 %
    { from: 162, to: 144, color: '#f59e0b' }, // 10-20 %
    { from: 144, to: 126, color: '#f97316' }, // 20-30 %
    { from: 126, to: 0,   color: '#ef4444' }, // 30-100 %
  ];

  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 240 140" className="w-full max-w-[260px]">
        {/* Zone arcs (subtle background) */}
        {zones.map((z, i) => (
          <path
            key={i}
            d={describeArc(CX, CY, R, z.from, z.to)}
            fill="none"
            stroke={z.color}
            strokeWidth={STROKE}
            strokeLinecap="round"
            opacity={0.15}
          />
        ))}

        {/* Background track */}
        <path
          d={bgArc}
          fill="none"
          stroke="rgba(100,116,139,0.18)"
          strokeWidth={STROKE}
          strokeLinecap="round"
        />

        {/* Value arc */}
        <path
          d={valueArc}
          fill="none"
          stroke={scoreColor(clamped)}
          strokeWidth={STROKE}
          strokeLinecap="round"
          className="transition-all duration-700 ease-out"
        />

        {/* Needle */}
        <line
          x1={CX}
          y1={CY}
          x2={needleTip.x}
          y2={needleTip.y}
          stroke={meta.color}
          strokeWidth={3}
          strokeLinecap="round"
          className="transition-all duration-700 ease-out"
        />
        <circle cx={CX} cy={CY} r={5} fill={meta.color} />
        <circle cx={CX} cy={CY} r={2.5} fill="var(--cardio-900, #0a1628)" />

        {/* Score text */}
        <text
          x={CX}
          y={CY - 18}
          textAnchor="middle"
          className="fill-slate-100 text-3xl font-bold"
          style={{ fontSize: '32px', fontWeight: 700 }}
        >
          {clamped}%
        </text>
      </svg>

      {/* Risk level label */}
      <span
        className="mt-1 text-sm font-semibold tracking-wider uppercase"
        style={{ color: meta.color }}
      >
        {meta.label}
      </span>
    </div>
  );
}
