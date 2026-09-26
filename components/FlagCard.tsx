"use client";
import { motion } from "framer-motion";
import type { Flag } from "@/lib/contracts";

const C = { high: "#e11d48", medium: "#f59e0b", low: "#64748b" } as const;

export function FlagCard({ flag, i }: { flag: Flag; i: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: i * 0.1, duration: 0.35 }}
      style={{
        padding: 16,
        margin: "10px 0",
        borderRadius: 12,
        background: "#0f172a",
        borderLeft: `4px solid ${C[flag.severity]}`,
      }}
    >
      <div style={{ fontSize: 12, color: C[flag.severity], textTransform: "uppercase", fontWeight: 800, letterSpacing: 0.5 }}>
        {flag.severity} · {flag.rule.replace(/_/g, " ")}
      </div>
      <div style={{ marginTop: 6, lineHeight: 1.5 }}>{flag.explanation}</div>
      {flag.context ? (
        <div style={{ marginTop: 8, fontSize: 13, opacity: 0.8, fontStyle: "italic" }}>
          Note on document: {String(flag.context)}
        </div>
      ) : null}
    </motion.div>
  );
}
