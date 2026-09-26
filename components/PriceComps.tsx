"use client";
import type { PriceComp } from "@/lib/contracts";

export function PriceComps({ comps, asking }: { comps: PriceComp[]; asking?: number }) {
  const cheapest = comps.reduce((m, c) => Math.min(m, c.price_inr), Infinity);
  const save = asking != null && cheapest < asking ? asking - cheapest : 0;
  return (
    <div>
      {asking != null && (
        <p className="tnum" style={{ margin: "0 0 10px", color: "var(--ink-2)", fontSize: 14 }}>
          Seller is asking <strong>₹{asking.toLocaleString("en-IN")}</strong>
          {save > 0 && (
            <span style={{ color: "var(--ok)", fontWeight: 600 }}>
              {" "}· a comparable car is ₹{save.toLocaleString("en-IN")} cheaper
            </span>
          )}
        </p>
      )}
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
