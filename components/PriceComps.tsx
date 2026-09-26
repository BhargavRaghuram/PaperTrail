"use client";
import { motion, useReducedMotion } from "framer-motion";
import type { MarketRange, PriceComp } from "@/lib/contracts";

const lakh = (n: number) => `₹${(n / 100000).toFixed(2).replace(/\.?0+$/, "")}L`;

/**
 * Horizontal bar chart — asking price read against the live market.
 * All bars share one scale; the market band sits behind them and the
 * asking price gets a hard marker so "over the range" is obvious at a glance.
 */
export function PriceComps({ comps, asking, market }: { comps: PriceComp[]; asking?: number; market?: MarketRange }) {
  const reduce = useReducedMotion();
  const priced = comps.filter((c) => c.price_inr > 0);
  const values = [...priced.map((c) => c.price_inr), asking ?? 0, market?.high ?? 0].filter(Boolean);
  const max = Math.max(...values, 1) * 1.08;

  let position: { text: string; color: string } | null = null;
  if (market && asking) {
    if (asking > market.high) position = { text: "above the typical range", color: "var(--danger)" };
    else if (asking < market.low) position = { text: "below the range — good value", color: "var(--ok)" };
    else position = { text: "within the typical range", color: "var(--ink-2)" };
  }

  const pct = (v: number) => `${(v / max) * 100}%`;
  const rows: { title: string; source: string; price: number; url?: string; self?: boolean }[] = [];
  if (asking) rows.push({ title: "This car", source: "seller's asking price", price: asking, self: true });
  priced.forEach((c) => rows.push({ title: c.title, source: c.source, price: c.price_inr, url: c.url }));

  return (
    <div className="card" style={{ padding: "20px 20px 8px" }}>
      {market && market.low > 0 && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 14, gap: 12, flexWrap: "wrap" }}>
          <div className="tnum" style={{ fontSize: 15 }}>
            Comparable cars sell for <strong>{lakh(market.low)}–{lakh(market.high)}</strong>
            {market.count > 4 && <span style={{ color: "var(--ink-3)" }}> · {market.count}+ listings</span>}
          </div>
          {position && (
            <span className="badge" style={{
              color: position.color,
              background: position.color === "var(--danger)" ? "var(--danger-tint)" : position.color === "var(--ok)" ? "var(--ok-tint)" : "var(--bone)",
            }}>{position.text}</span>
          )}
        </div>
      )}

      <div style={{ position: "relative" }}>
        {/* market range band behind the bars */}
        {market && market.low > 0 && (
          <div aria-hidden style={{
            position: "absolute", top: 0, bottom: 8,
            left: pct(market.low), width: `calc(${pct(market.high)} - ${pct(market.low)})`,
            background: "var(--mint)", opacity: 0.5, borderRadius: 6, zIndex: 0,
          }} />
        )}

        {rows.map((r, i) => {
          const better = asking != null && !r.self && r.price < asking;
          const over = r.self && market && r.price > market.high;
          const barColor = r.self ? (over ? "var(--danger)" : "var(--iris-deep)") : "var(--iris)";
          const Row = (
            <div style={{ position: "relative", padding: "9px 0", zIndex: 1 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 5, gap: 10 }}>
                <span style={{ fontSize: 13.5, fontWeight: r.self ? 650 : 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {r.title} <span style={{ color: "var(--ink-3)", fontWeight: 400, fontSize: 12 }}>· {r.source}</span>
                </span>
                <span className="tnum" style={{ fontSize: 13.5, fontWeight: 700, whiteSpace: "nowrap", color: better ? "var(--ok)" : over ? "var(--danger)" : "var(--ink)" }}>
                  ₹{r.price.toLocaleString("en-IN")}
                </span>
              </div>
              <div style={{ height: r.self ? 12 : 9, borderRadius: 6, background: "var(--hair)", overflow: "hidden" }}>
                <motion.div
                  initial={reduce ? false : { width: 0 }}
                  whileInView={reduce ? undefined : { width: pct(r.price) }}
                  viewport={{ once: true, margin: "-12%" }}
                  transition={{ duration: 0.7, delay: Math.min(i * 0.06, 0.4), ease: [0.16, 1, 0.3, 1] }}
                  style={{ height: "100%", width: reduce ? pct(r.price) : undefined, background: barColor, borderRadius: 6 }}
                />
              </div>
            </div>
          );
          return r.url ? (
            <a key={i} href={r.url} target="_blank" rel="noreferrer noopener" style={{ display: "block", textDecoration: "none", color: "inherit" }}>{Row}</a>
          ) : (
            <div key={i}>{Row}</div>
          );
        })}
      </div>

      {comps.some((c) => c.price_inr <= 0) && (
        <p style={{ margin: "10px 0 12px", fontSize: 13 }}>
          {comps.filter((c) => c.price_inr <= 0).map((c, i) => (
            <a key={i} href={c.url} target="_blank" rel="noreferrer noopener" style={{ marginRight: 14 }}>
              {c.source} listings →
            </a>
          ))}
        </p>
      )}
    </div>
  );
}
