"use client";
import { motion, useReducedMotion } from "framer-motion";
import type { TLEvent } from "@/lib/contracts";
import { ArrowDown } from "./icons";

const LABEL: Record<string, string> = {
  registration: "Registered",
  service: "Service",
  insurance_start: "Insurance begins",
  insurance_end: "Insurance ends",
  challan: "Traffic challan",
};

type Row = TLEvent & { isDrop: boolean; delta: number | null };

function annotate(events: TLEvent[], breakDates: string[]): Row[] {
  let last: number | null = null;
  return events.map((e) => {
    const km = typeof e.odometer_km === "number" ? e.odometer_km : null;
    const isDrop = km != null && last != null && km < last && breakDates.includes(e.date);
    const delta = isDrop ? km! - (last as number) : null;
    if (km != null) last = km;
    return { ...e, isDrop, delta };
  });
}

export function Timeline({ events, breakDates }: { events: TLEvent[]; breakDates: string[] }) {
  const rows = annotate(events, breakDates);
  const reduce = useReducedMotion();

  return (
    <ol style={{ listStyle: "none", margin: 0, padding: 0, position: "relative" }}>
      {/* instrument spine */}
      <div aria-hidden style={{ position: "absolute", left: 6.5, top: 10, bottom: 12, width: 2, background: "var(--hair-2)" }} />
      {rows.map((e, i) => {
        const accent = e.isDrop ? "var(--danger)" : "var(--iris-deep)";
        return (
          <motion.li
            key={e.date + e.type + i}
            initial={reduce ? false : { opacity: 0, x: -6 }}
            whileInView={reduce ? undefined : { opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-8% 0px" }}
            transition={{ duration: 0.4, delay: Math.min(i * 0.05, 0.4), ease: [0.16, 1, 0.3, 1] }}
            style={{ position: "relative", paddingLeft: 30, paddingBottom: i === rows.length - 1 ? 0 : 20 }}
          >
            <span aria-hidden style={{
              position: "absolute", left: 0, top: 3, width: 15, height: 15, borderRadius: "50%",
              background: e.type === "registration" || e.isDrop ? accent : "var(--surface)",
              border: `2px solid ${accent}`, boxShadow: "0 0 0 4px var(--paper)", zIndex: 1,
            }} />
            {e.isDrop && !reduce && (
              <span aria-hidden style={{
                position: "absolute", left: -2, top: 1, width: 19, height: 19, borderRadius: "50%",
                border: "2px solid var(--danger)", transformOrigin: "center",
                animation: "ping-fade 1.6s var(--ease-out) 0.4s 2",
              }} />
            )}
            <div className="eyebrow" style={{ letterSpacing: "0.08em" }}>
              <span className="tnum">{e.date}</span> · {e.source}
            </div>
            <div style={{ fontSize: 15.5, marginTop: 3, color: e.isDrop ? "var(--danger)" : "var(--ink)", fontWeight: e.isDrop ? 650 : 500 }}>
              {LABEL[e.type] ?? e.type}
              {typeof e.odometer_km === "number" && (
                <span className="tnum" style={{ color: e.isDrop ? "var(--danger)" : "var(--ink-2)", fontWeight: 500 }}> · {e.odometer_km.toLocaleString("en-IN")} km</span>
              )}
              {e.type === "challan" && e.note && (
                <span style={{ fontWeight: 400, color: "var(--warn)" }}> · {e.note}</span>
              )}
              {e.isDrop && e.delta != null && (
                <span className="tnum badge" style={{ marginLeft: 8, color: "var(--danger)", background: "var(--danger-tint)", fontWeight: 700 }}>
                  <ArrowDown width={12} height={12} /> {Math.abs(e.delta).toLocaleString("en-IN")} km
                </span>
              )}
            </div>
          </motion.li>
        );
      })}
    </ol>
  );
}
