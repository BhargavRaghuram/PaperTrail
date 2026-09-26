"use client";
import type { PriceComp } from "@/lib/contracts";

export function PriceComps({ comps, asking }: { comps: PriceComp[]; asking?: number }) {
  return (
    <div>
      {comps.map((c, i) => {
        const better = asking != null && c.price_inr < asking;
        return (
          <a
            key={i}
            href={c.url}
            target="_blank"
            rel="noreferrer noopener"
            style={{
              display: "grid", gridTemplateColumns: "1fr auto", gap: 14, alignItems: "baseline",
              padding: "14px 0", borderTop: "1px solid var(--hair)", textDecoration: "none", color: "inherit",
            }}
          >
            <div>
              <div style={{ fontWeight: 600 }}>{c.title}</div>
              <div style={{ fontSize: 13, color: "var(--ink-3)" }}>{c.source}</div>
            </div>
            <div className="tnum" style={{ textAlign: "right", whiteSpace: "nowrap" }}>
              <span style={{ fontWeight: 700, fontSize: 17, color: better ? "var(--ok)" : "var(--ink)" }}>
                ₹{c.price_inr.toLocaleString("en-IN")}
              </span>
              {better && <div style={{ fontSize: 12, color: "var(--ok)", fontWeight: 600 }}>better value</div>}
            </div>
          </a>
        );
      })}
    </div>
  );
}
