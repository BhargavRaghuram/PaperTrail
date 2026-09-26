"use client";
import { motion, useReducedMotion } from "framer-motion";

export type Stat = { label: string; value: string; sub?: string; tone?: "ink" | "danger" | "warn" | "ok" };
const TONE = { ink: "var(--ink)", danger: "var(--danger)", warn: "var(--warn)", ok: "var(--ok)" };

/** Mono metric strip — the instrument readout below the verdict. */
export function StatStrip({ stats }: { stats: Stat[] }) {
  const reduce = useReducedMotion();
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${stats.length}, 1fr)`,
        background: "var(--bone)",
        border: "1px solid var(--hair)",
        borderRadius: "var(--r-md)",
        overflow: "hidden",
      }}
    >
      {stats.map((s, i) => (
        <motion.div
          key={s.label}
          initial={reduce ? false : { opacity: 0, y: 8 }}
          whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4, delay: Math.min(i * 0.06, 0.3), ease: [0.16, 1, 0.3, 1] }}
          style={{
            padding: "16px 18px",
            borderLeft: i === 0 ? "none" : "1px solid var(--hair)",
          }}
        >
          <div className="tnum" style={{ fontSize: 26, fontWeight: 600, letterSpacing: "-0.03em", color: TONE[s.tone ?? "ink"] }}>
            {s.value}
          </div>
          <div className="eyebrow" style={{ marginTop: 6 }}>{s.label}</div>
          {s.sub && <div style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 3 }}>{s.sub}</div>}
        </motion.div>
      ))}
    </div>
  );
}
