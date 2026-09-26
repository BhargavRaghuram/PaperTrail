"use client";
import type { PartRisk } from "@/lib/contracts";

const S = { overdue: "#e11d48", due_soon: "#f59e0b", ok: "#334155" } as const;

export function PartRiskCard({ risk }: { risk: PartRisk }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: 12,
        padding: "12px 14px",
        margin: "6px 0",
        borderRadius: 10,
        background: "#0f172a",
        borderLeft: `4px solid ${S[risk.status]}`,
      }}
    >
      <div>
        <b>{risk.part}</b>{" "}
        <span style={{ fontSize: 12, opacity: 0.6 }}>({risk.priority} priority · {risk.status.replace("_", " ")})</span>
        <div style={{ fontSize: 12, opacity: 0.8, marginTop: 2 }}>{risk.reason}</div>
      </div>
      <div style={{ whiteSpace: "nowrap", fontWeight: 800 }}>₹{risk.est_cost_inr.toLocaleString()}</div>
    </div>
  );
}
