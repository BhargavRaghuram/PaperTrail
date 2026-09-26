"use client";
import { motion } from "framer-motion";
import type { TLEvent } from "@/lib/contracts";

const label: Record<string, string> = {
  registration: "Registration",
  service: "Service",
  insurance_start: "Insurance start",
  insurance_end: "Insurance end",
};

export function Timeline({ events, breakDates }: { events: TLEvent[]; breakDates: string[] }) {
  return (
    <ol style={{ listStyle: "none", padding: 0, margin: 0 }}>
      {events.map((e, i) => {
        const isBreak = breakDates.includes(e.date);
        return (
          <motion.li
            key={e.date + e.type + i}
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.08, duration: 0.35 }}
            style={{
              padding: "12px 16px",
              margin: "8px 0",
              borderLeft: `3px solid ${isBreak ? "#fb7185" : "#334155"}`,
              background: isBreak ? "#2a0e14" : "#0f172a",
              borderRadius: 10,
            }}
          >
            <div style={{ fontSize: 12, opacity: 0.65 }}>
              {e.date} · {e.source}
            </div>
            <div style={{ fontWeight: 600, marginTop: 2 }}>
              {label[e.type] ?? e.type}
              {typeof e.odometer_km === "number" && <span> — {e.odometer_km.toLocaleString()} km</span>}
              {isBreak && <span style={{ color: "#fb7185", fontWeight: 700 }}> ⚠ odometer break</span>}
            </div>
          </motion.li>
        );
      })}
    </ol>
  );
}
