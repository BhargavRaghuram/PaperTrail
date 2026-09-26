"use client";
import { motion, useReducedMotion } from "framer-motion";
import type { PartRisk } from "@/lib/contracts";

const STATUS = {
  overdue: { color: "var(--danger)", tint: "var(--danger-tint)", label: "Overdue", fill: 1 },
  due_soon: { color: "var(--warn)", tint: "var(--warn-tint)", label: "Due soon", fill: 0.8 },
  ok: { color: "var(--ok)", tint: "var(--ok-tint)", label: "Healthy", fill: 0.4 },
} as const;

/** Life-remaining meter per part — how close it is to needing replacement, and the cost when it does. */
export function PartRiskCard({ risk, i = 0 }: { risk: PartRisk; i?: number }) {
  const s = STATUS[risk.status];
  const reduce = useReducedMotion();

  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 8 }}
      whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-10%" }}
      transition={{ duration: 0.4, delay: Math.min(i * 0.07, 0.35), ease: [0.16, 1, 0.3, 1] }}
      style={{ padding: "16px 0", borderTop: "1px solid var(--hair)" }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, marginBottom: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <span style={{ fontWeight: 600, fontSize: 15 }}>{risk.part}</span>
          <span className="badge" style={{ color: s.color, background: s.tint }}>{s.label}</span>
        </div>
        <span className="tnum" style={{ fontWeight: 700, fontSize: 16, whiteSpace: "nowrap", color: s.color }}>
          ~₹{risk.est_cost_inr.toLocaleString("en-IN")}
        </span>
      </div>
      <div aria-hidden style={{ height: 8, borderRadius: 6, background: "var(--hair)", overflow: "hidden", marginBottom: 8 }}>
        <motion.div
          initial={reduce ? false : { width: 0 }}
          whileInView={reduce ? undefined : { width: `${s.fill * 100}%` }}
          viewport={{ once: true, margin: "-12%" }}
          transition={{ duration: 0.8, delay: 0.1 + Math.min(i * 0.07, 0.35), ease: [0.16, 1, 0.3, 1] }}
          style={{ height: "100%", width: reduce ? `${s.fill * 100}%` : undefined, background: s.color, borderRadius: 6 }}
        />
      </div>
      <p style={{ margin: 0, fontSize: 13.5, color: "var(--ink-2)", maxWidth: "60ch", lineHeight: 1.5 }}>{risk.reason}</p>
    </motion.div>
  );
}
