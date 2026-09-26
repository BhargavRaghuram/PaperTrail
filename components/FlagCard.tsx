"use client";
import { motion, useReducedMotion } from "framer-motion";
import type { Flag } from "@/lib/contracts";
import { AlertTriangle, Dot } from "./icons";

const SEV = {
  high: { color: "var(--danger)", tint: "var(--danger-tint)", label: "High" },
  medium: { color: "var(--warn)", tint: "var(--warn-tint)", label: "Medium" },
  low: { color: "var(--neutral)", tint: "#f1ede4", label: "Low" },
} as const;

export function FlagCard({ flag, i }: { flag: Flag; i: number }) {
  const s = SEV[flag.severity];
  const reduce = useReducedMotion();
  const title = flag.rule.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <motion.article
      initial={reduce ? false : { opacity: 0, y: 10 }}
      animate={reduce ? undefined : { opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: i * 0.08, ease: [0.16, 1, 0.3, 1] }}
      style={{ display: "flex", gap: 14, padding: "18px 0", borderTop: "1px solid var(--hair)" }}
    >
      <div aria-hidden style={{ flex: "none", width: 34, height: 34, borderRadius: "50%", display: "grid", placeItems: "center", background: s.tint, color: s.color }}>
        {flag.severity === "high" ? <AlertTriangle width={18} height={18} /> : <Dot color={s.color} size={9} />}
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <h3 style={{ fontFamily: "var(--font-body)", fontSize: 16, fontWeight: 650, letterSpacing: "-0.01em" }}>{title}</h3>
          <span
            style={{
              fontSize: 11, fontWeight: 700, letterSpacing: 0.6, textTransform: "uppercase",
              color: s.color, background: s.tint, padding: "2px 8px", borderRadius: 999,
            }}
          >
            {s.label}
          </span>
        </div>
        <p style={{ margin: "6px 0 0", color: "var(--ink-2)", maxWidth: "60ch", lineHeight: 1.55 }}>{flag.explanation}</p>
        {flag.context ? (
          <p style={{ margin: "8px 0 0", fontSize: 13.5, color: "var(--ink-3)", fontStyle: "italic" }}>
            Noted on the document: “{String(flag.context)}”
          </p>
        ) : null}
      </div>
    </motion.article>
  );
}
