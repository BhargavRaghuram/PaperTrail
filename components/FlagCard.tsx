"use client";
import { motion, useReducedMotion } from "framer-motion";
import type { Flag } from "@/lib/contracts";
import { AlertTriangle, Dot } from "./icons";

const SEV = {
  high: { color: "var(--danger)", tint: "var(--danger-tint)", label: "High" },
  medium: { color: "var(--warn)", tint: "var(--warn-tint)", label: "Medium" },
  low: { color: "var(--ink-3)", tint: "var(--bone)", label: "Low" },
} as const;

export function FlagCard({ flag, i }: { flag: Flag; i: number }) {
  const s = SEV[flag.severity];
  const reduce = useReducedMotion();
  const title = flag.rule.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <motion.article
      initial={reduce ? false : { opacity: 0, y: 10 }}
      whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-8%" }}
      transition={{ duration: 0.42, delay: Math.min(i * 0.07, 0.35), ease: [0.16, 1, 0.3, 1] }}
      className="card"
      style={{ display: "flex", gap: 14, padding: 18, marginBottom: 12 }}
    >
      <div aria-hidden style={{ flex: "none", width: 34, height: 34, borderRadius: "50%", display: "grid", placeItems: "center", background: s.tint, color: s.color }}>
        {flag.severity === "high" ? <AlertTriangle width={18} height={18} /> : <Dot color={s.color} size={9} />}
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span className="eyebrow" style={{ letterSpacing: "0.1em" }}>{flag.rule.replace(/_/g, " ")}</span>
          <span className="badge" style={{ color: s.color, background: s.tint }}>{s.label}</span>
        </div>
        <h3 style={{ fontSize: 16.5, fontWeight: 650, letterSpacing: "-0.02em", margin: "5px 0 0" }}>{title}</h3>
        <p style={{ margin: "6px 0 0", color: "var(--ink-2)", maxWidth: "60ch", lineHeight: 1.5, fontSize: 14 }}>{flag.explanation}</p>
        {flag.context ? (
          <p className="mono" style={{ margin: "10px 0 0", fontSize: 12.5, color: "var(--ink-2)", background: "var(--bone)", border: "1px solid var(--hair)", borderRadius: "var(--r-xs)", padding: "8px 11px" }}>
            on document: “{String(flag.context)}”
          </p>
        ) : null}
      </div>
    </motion.article>
  );
}
