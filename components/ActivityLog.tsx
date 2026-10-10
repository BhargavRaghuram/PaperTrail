"use client";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

export type LogStatus = "pending" | "active" | "done" | "error";
export interface LogLine {
  id: string;
  text: string;
  status: LogStatus;
  /** "scan" shows the tilting-document motif (document reads); "search" is a plain pulse (web lookups). */
  kind?: "scan" | "search";
}

const DOT: Record<LogStatus, string> = {
  pending: "var(--hair-2)",
  active: "var(--iris-deep)",
  done: "var(--ok)",
  error: "var(--danger)",
};

function ScanIcon({ active, reduce }: { active: boolean; reduce: boolean | null }) {
  return (
    <div style={{ perspective: 220, width: 22, height: 17, flex: "none" }}>
      <motion.div
        style={{
          width: "100%", height: "100%", borderRadius: 3,
          background: "var(--paper)", border: "1px solid var(--hair-2)",
          position: "relative", overflow: "hidden", transformStyle: "preserve-3d",
        }}
        animate={active && !reduce ? { rotateX: [6, -6, 6], rotateY: [-8, 8, -8] } : { rotateX: 0, rotateY: 0 }}
        transition={{ duration: 2.4, repeat: active && !reduce ? Infinity : 0, ease: "easeInOut" }}
      >
        <div aria-hidden style={{ position: "absolute", inset: "2px 3px", display: "flex", flexDirection: "column", gap: 2 }}>
          {[1, 1, 0.6].map((w, i) => (
            <span key={i} style={{ height: 2, width: `${w * 100}%`, background: "var(--hair-2)", borderRadius: 1 }} />
          ))}
        </div>
        {active && !reduce && (
          <motion.div
            aria-hidden
            animate={{ transform: ["translateY(-5px)", "translateY(20px)"] }}
            transition={{ duration: 1.1, repeat: Infinity, ease: "linear" }}
            style={{ position: "absolute", left: 0, right: 0, height: "35%", background: "linear-gradient(180deg, transparent, var(--iris-tint), transparent)" }}
          />
        )}
      </motion.div>
    </div>
  );
}

export function ActivityLog({ lines }: { lines: LogLine[] }) {
  const reduce = useReducedMotion();
  if (!lines.length) return null;

  return (
    <div className="card" style={{ padding: "16px 18px", marginTop: 18 }}>
      <AnimatePresence initial={false}>
        {lines.map((l) => (
          <motion.div
            key={l.id}
            layout
            initial={reduce ? false : { opacity: 0, transform: "translateX(-8px)" }}
            animate={{ opacity: 1, transform: "translateX(0px)" }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0" }}
          >
            {l.kind === "scan" ? (
              <ScanIcon active={l.status === "active"} reduce={reduce} />
            ) : (
              <span aria-hidden style={{ position: "relative", width: 8, height: 8, flex: "none" }}>
                <span style={{ display: "block", width: 8, height: 8, borderRadius: "50%", background: DOT[l.status] }} />
                {l.status === "active" && !reduce && (
                  <span
                    aria-hidden
                    style={{
                      position: "absolute", inset: 0, borderRadius: "50%", background: DOT.active,
                      animation: "ping-fade 1.3s var(--ease-out) infinite",
                    }}
                  />
                )}
              </span>
            )}
            <span className="mono" style={{ fontSize: 13.5, color: l.status === "pending" ? "var(--ink-3)" : "var(--ink)" }}>
              {l.text}
            </span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
