"use client";
import type { PartRisk } from "@/lib/contracts";
import { Dot } from "./icons";

const STATUS = {
  overdue: { color: "var(--danger)", label: "Overdue" },
  due_soon: { color: "var(--warn)", label: "Due soon" },
  ok: { color: "var(--ok)", label: "OK" },
} as const;

export function PartRiskCard({ risk }: { risk: PartRisk }) {
  const s = STATUS[risk.status];
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr auto",
        gap: 14,
        alignItems: "baseline",
        padding: "14px 0",
        borderTop: "1px solid var(--hair)",
      }}
    >
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Dot color={s.color} size={8} />
          <span style={{ fontWeight: 600 }}>{risk.part}</span>
          <span style={{ fontSize: 12, color: s.color, fontWeight: 600 }}>{s.label}</span>
        </div>
        <p style={{ margin: "4px 0 0 16px", fontSize: 13.5, color: "var(--ink-3)", maxWidth: "56ch" }}>{risk.reason}</p>
      </div>
      <div className="tnum" style={{ fontWeight: 700, fontSize: 17, whiteSpace: "nowrap" }}>
        ₹{risk.est_cost_inr.toLocaleString("en-IN")}
      </div>
    </div>
  );
}
