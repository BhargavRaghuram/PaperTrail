"use client";
import { useEffect, useState } from "react";
import type { Report } from "@/lib/contracts";
import { heroReport } from "./heroData";
import { Timeline } from "@/components/Timeline";
import { FlagCard } from "@/components/FlagCard";
import { PartRiskCard } from "@/components/PartRiskCard";
import { QuestionSheet } from "@/components/QuestionSheet";

const section: React.CSSProperties = { margin: "28px 0" };
const h2: React.CSSProperties = { fontSize: 20, fontWeight: 700, margin: "0 0 10px" };

export default function ReportPage() {
  const [r, setR] = useState<Report>(heroReport);
  const [stage, setStage] = useState(0); // 0 timeline, 1 flags, 2 costs, 3 questions

  useEffect(() => {
    const s = sessionStorage.getItem("papertrail_report");
    if (s) {
      try {
        setR(JSON.parse(s));
      } catch {
        /* keep hero fallback */
      }
    }
  }, []);

  useEffect(() => {
    const t = [700, 1400, 2100].map((ms, i) => setTimeout(() => setStage(i + 1), ms));
    return () => t.forEach(clearTimeout);
  }, []);

  const breakDates = r.flags
    .filter((f) => f.rule === "odometer_regression" || f.rule === "implausible_mileage_jump")
    .flatMap((f) => (f.entries as string[]) ?? []);

  const activeCosts = r.part_risks.filter((p) => p.status !== "ok");

  return (
    <main
      style={{
        maxWidth: 760,
        margin: "0 auto",
        padding: "32px 24px 80px",
        color: "#e2e8f0",
        background: "#020617",
        minHeight: "100vh",
        fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif",
      }}
    >
      <div style={{ fontSize: 13, letterSpacing: 2, opacity: 0.6, textTransform: "uppercase" }}>PaperTrail</div>
      <h1 style={{ fontSize: 28, fontWeight: 800, margin: "4px 0 2px" }}>
        {[r.car.make, r.car.model, r.car.year].filter(Boolean).join(" ") || "Car report"}
      </h1>
      <div style={{ opacity: 0.7 }}>
        {r.car.reg_number} · {r.car.current_odometer_km?.toLocaleString()} km
      </div>

      <section style={section}>
        <h2 style={h2}>Timeline</h2>
        <Timeline events={r.timeline} breakDates={breakDates} />
      </section>

      {stage >= 1 && (
        <section style={section}>
          <h2 style={h2}>Issues found ({r.flags.length})</h2>
          {r.flags.length === 0 ? (
            <div style={{ opacity: 0.7 }}>No inconsistencies detected in the documents.</div>
          ) : (
            r.flags.map((f, i) => <FlagCard key={i} flag={f} i={i} />)
          )}
          {r.unreadable_notices.length > 0 && (
            <div style={{ marginTop: 10, fontSize: 13, opacity: 0.8 }}>
              {r.unreadable_notices.map((n, i) => (
                <div key={i}>⚠ {n.message}</div>
              ))}
            </div>
          )}
        </section>
      )}

      {stage >= 2 && activeCosts.length > 0 && (
        <section style={section}>
          <h2 style={h2}>Hidden future costs</h2>
          {activeCosts.map((p, i) => (
            <PartRiskCard key={i} risk={p} />
          ))}
        </section>
      )}

      {stage >= 3 && r.questions.length > 0 && (
        <section style={section}>
          <h2 style={h2}>Questions for the seller</h2>
          <QuestionSheet questions={r.questions} />
        </section>
      )}
    </main>
  );
}
