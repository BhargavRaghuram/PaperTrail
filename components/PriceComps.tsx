"use client";
import type { MarketRange, PriceComp } from "@/lib/contracts";

const lakh = (n: number) => `₹${(n / 100000).toFixed(2).replace(/\.00$/, "")}L`;

export function PriceComps({ comps, asking, market }: { comps: PriceComp[]; asking?: number; market?: MarketRange }) {
  let position: { text: string; color: string } | null = null;
  if (market && asking) {
    if (asking > market.high) position = { text: "above the typical market range", color: "var(--danger)" };
    else if (asking < market.low) position = { text: "below the typical market range — good value", color: "var(--ok)" };
    else position = { text: "within the typical market range", color: "var(--ink-2)" };
  }

  return (
    <div>
      {market && market.low > 0 && (
        <p className="tnum" style={{ margin: "0 0 6px", fontSize: 15 }}>
          Comparable cars sell for{" "}
          <strong>
            {lakh(market.low)}–{lakh(market.high)}
          </strong>
          {market.count > 4 && <span style={{ color: "var(--ink-3)" }}> across {market.count}+ listings</span>}
        </p>
      )}
      {asking != null && (
        <p className="tnum" style={{ margin: "0 0 14px", fontSize: 14, color: "var(--ink-2)" }}>
          Seller is asking <strong>₹{asking.toLocaleString("en-IN")}</strong>
          {position && <span style={{ color: position.color, fontWeight: 600 }}> · {position.text}</span>}
        </p>
      )}

      {comps.map((c, i) => {
        const better = asking != null && c.price_inr > 0 && c.price_inr < asking;
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
              {c.price_inr > 0 ? (
                <>
                  <span style={{ fontWeight: 700, fontSize: 17, color: better ? "var(--ok)" : "var(--ink)" }}>
                    ₹{c.price_inr.toLocaleString("en-IN")}
                  </span>
                  {better && <div style={{ fontSize: 12, color: "var(--ok)", fontWeight: 600 }}>better value</div>}
                </>
              ) : (
                <span style={{ fontSize: 14, color: "var(--ink-3)", textDecoration: "underline" }}>View listings →</span>
              )}
            </div>
          </a>
        );
      })}
    </div>
  );
}
