"use client";
import { motion, useReducedMotion } from "framer-motion";

type Tone = "ok" | "warn" | "danger";
const COLOR: Record<Tone, string> = { ok: "var(--ok)", warn: "var(--warn)", danger: "var(--danger)" };

/**
 * Semicircular instrument gauge — the report's headline reading.
 * Score 0–100 (100 = papers fully corroborate the seller). The needle
 * sweeps in on load; the arc fills to the score in the verdict's tone.
 */
export function VerdictGauge({ score, tone }: { score: number; tone: Tone }) {
  const reduce = useReducedMotion();
  const s = Math.max(0, Math.min(100, score));
  const R = 90, cx = 110, cy = 108, sw = 14;
  const a0 = Math.PI, a1 = 0; // 180° → 0°
  const ang = a0 + (a1 - a0) * (s / 100);

  const pt = (a: number, r: number) => [cx + Math.cos(a) * r, cy - Math.sin(a) * r] as const;
  const arc = (from: number, to: number, r: number) => {
    const [x0, y0] = pt(from, r);
    const [x1, y1] = pt(to, r);
    const large = Math.abs(to - from) > Math.PI ? 1 : 0;
    return `M${x0.toFixed(2)} ${y0.toFixed(2)} A${r} ${r} 0 ${large} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
  };
  const [nx, ny] = pt(ang, R - 20);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
      <svg viewBox="0 0 220 128" width="176" height="102" role="img" aria-label={`Clarity score ${s} out of 100`}>
        {/* track */}
        <path d={arc(a0, a1, R)} fill="none" stroke="var(--hair)" strokeWidth={sw} strokeLinecap="round" />
        {/* filled arc */}
        <motion.path
          d={arc(a0, a1, R)} fill="none" stroke={COLOR[tone]} strokeWidth={sw} strokeLinecap="round"
          initial={reduce ? { pathLength: s / 100 } : { pathLength: 0 }}
          animate={{ pathLength: s / 100 }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1], delay: 0.15 }}
        />
        {/* needle */}
        <motion.line
          x1={cx} y1={cy} x2={nx} y2={ny} stroke="var(--ink)" strokeWidth="3" strokeLinecap="round"
          initial={reduce ? false : { rotate: 90 }}
          animate={reduce ? undefined : { rotate: 0 }}
          transition={{ type: "spring", duration: 0.9, bounce: 0.22, delay: 0.15 }}
          style={{ transformOrigin: `${cx}px ${cy}px` }}
        />
        <circle cx={cx} cy={cy} r="6" fill="var(--ink)" />
        <text x={cx} y={cy - 26} textAnchor="middle" className="tnum"
          fontFamily="var(--font-body)" fontSize="34" fontWeight="600" fill="var(--ink)" letterSpacing="-0.03em">
          {s}
        </text>
      </svg>
      <div>
        <div className="eyebrow" style={{ marginBottom: 4 }}>Clarity score</div>
        <div style={{ fontSize: 13.5, color: "var(--ink-2)", maxWidth: "24ch", lineHeight: 1.45 }}>
          How much the paperwork corroborates the seller&apos;s story.
        </div>
      </div>
    </div>
  );
}
