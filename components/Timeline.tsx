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

type Row = TLEvent & { isDrop: boolean; delta: number | null; isBreak: boolean };

function annotate(events: TLEvent[], breakDates: string[]): Row[] {
  let last: number | null = null;
  return events.map((e) => {
    const km = typeof e.odometer_km === "number" ? e.odometer_km : null;
    const isDrop = km != null && last != null && km < last && breakDates.includes(e.date);
    const delta = isDrop ? km! - (last as number) : null;
    if (km != null) last = km;
    return { ...e, isDrop, delta, isBreak: breakDates.includes(e.date) };
  });
}

export function Timeline({ events, breakDates }: { events: TLEvent[]; breakDates: string[] }) {
  const rows = annotate(events, breakDates);
  const reduce = useReducedMotion();

  return (
    <ol style={{ listStyle: "none", margin: 0, padding: 0, position: "relative" }}>
      <div aria-hidden style={{ position: "absolute", left: 6, top: 8, bottom: 8, width: 1, background: "var(--hair-strong)" }} />
      {rows.map((e, i) => {
        const accent = e.isDrop ? "var(--danger)" : "var(--ink)";
        return (
          <motion.li
            key={e.date + e.type + i}
            initial={reduce ? false : { opacity: 0, y: 8 }}
            whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-10% 0px" }}
            transition={{ duration: 0.4, delay: Math.min(i * 0.05, 0.4), ease: [0.16, 1, 0.3, 1] }}
            style={{ position: "relative", paddingLeft: 30, paddingBottom: i === rows.length - 1 ? 0 : 22 }}
          >
            <span
              aria-hidden
              style={{
                position: "absolute", left: 0, top: 4, width: 13, height: 13, borderRadius: "50%",
                background: e.type === "registration" || e.isDrop ? accent : "var(--surface)",
                border: `2px solid ${accent}`, boxShadow: "0 0 0 4px var(--paper)",
              }}
            />
            {e.isDrop && !reduce && (
              <motion.span
                aria-hidden
                style={{ position: "absolute", left: -3, top: 1, width: 19, height: 19, borderRadius: "50%", border: "2px solid var(--danger)" }}
                initial={{ opacity: 0.7, scale: 0.7 }}
                animate={{ opacity: 0, scale: 2.1 }}
                transition={{ duration: 1.4, repeat: 2, ease: "easeOut", delay: 0.3 }}
              />
            )}
            <div style={{ fontSize: 12.5, color: "var(--ink-3)", letterSpacing: 0.1 }}>
              <span className="tnum">{e.date}</span> · {e.source}
            </div>
            <div style={{ fontSize: 16, marginTop: 2, color: e.isDrop ? "var(--danger)" : "var(--ink)", fontWeight: e.isDrop ? 600 : 500 }}>
              {LABEL[e.type] ?? e.type}
              {typeof e.odometer_km === "number" && (
                <span className="tnum"> — {e.odometer_km.toLocaleString("en-IN")} km</span>
              )}
              {e.type === "challan" && e.note && (
                <span style={{ fontWeight: 400, color: "var(--warn)" }}> — {e.note}</span>
              )}
              {e.isDrop && e.delta != null && (
                <span className="tnum" style={{ display: "inline-flex", alignItems: "center", gap: 3, marginLeft: 8, fontWeight: 700 }}>
                  <ArrowDown width={14} height={14} />
                  {e.delta.toLocaleString("en-IN")} km
                </span>
              )}
            </div>
          </motion.li>
        );
      })}
    </ol>
  );
}
