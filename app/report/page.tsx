"use client";
import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import type { Report } from "@/lib/contracts";
import { heroReport } from "./heroData";
import { Timeline } from "@/components/Timeline";
import { FlagCard } from "@/components/FlagCard";
import { PartRiskCard } from "@/components/PartRiskCard";
import { QuestionSheet } from "@/components/QuestionSheet";
import { PriceComps } from "@/components/PriceComps";
import { Check } from "@/components/icons";

const wrap: React.CSSProperties = { maxWidth: 720, margin: "0 auto", padding: "clamp(28px, 5vw, 56px) 22px 96px" };
const h2: React.CSSProperties = { fontSize: "clamp(24px, 4vw, 30px)", margin: "0 0 4px" };
const sub: React.CSSProperties = { color: "var(--ink-3)", fontSize: 14, margin: "0 0 20px" };

function section(): React.CSSProperties {
  return { marginTop: 52 };
}

export default function ReportPage() {
  const [r, setR] = useState<Report>(heroReport);
  const reduce = useReducedMotion();

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

  const breakDates = r.flags
    .filter((f) => f.rule === "odometer_regression" || f.rule === "implausible_mileage_jump")
    .flatMap((f) => (f.entries as string[]) ?? []);

  const activeCosts = r.part_risks.filter((p) => p.status !== "ok");
  const highs = r.flags.filter((f) => f.severity === "high").length;
  const n = r.flags.length;
  const verdictColor = highs > 0 ? "var(--danger)" : n > 0 ? "var(--warn)" : "var(--ok)";
  const verdict =
    n === 0
      ? "Nothing in the papers contradicts the seller's story."
      : `${n} ${n === 1 ? "issue" : "issues"} to raise before you pay${highs ? ` — ${highs} serious.` : "."}`;

  const carName = [r.car.make, r.car.model].filter(Boolean).join(" ") || "This car";
  const carLabel = [carName, r.car.year, r.car.reg_number].filter(Boolean).join(" · ");

  return (
    <main style={wrap}>
      <motion.header
        data-print="hide"
        initial={reduce ? false : { opacity: 0, y: 10 }}
        animate={reduce ? undefined : { opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      >
        <div style={{ fontSize: 12, letterSpacing: "0.22em", textTransform: "uppercase", color: "var(--ink-3)" }}>
          PaperTrail
        </div>
        <h1 style={{ fontSize: "clamp(38px, 8vw, 62px)", margin: "10px 0 6px", letterSpacing: "-0.02em" }}>
          {carName}
        </h1>
        <div className="tnum" style={{ color: "var(--ink-2)", fontSize: 15 }}>
          {[r.car.year, r.car.reg_number, r.car.current_odometer_km ? `${r.car.current_odometer_km.toLocaleString("en-IN")} km` : null]
            .filter(Boolean)
            .join("  ·  ")}
        </div>
        <p
          style={{
            fontFamily: "var(--font-display)", fontSize: "clamp(20px, 3.5vw, 26px)",
            color: verdictColor, margin: "22px 0 0", display: "flex", alignItems: "center", gap: 10,
          }}
        >
          {n === 0 && <Check width={22} height={22} />}
          {verdict}
        </p>
      </motion.header>

      <section style={section()} aria-labelledby="tl" data-print="hide">
        <h2 id="tl" style={h2}>The paper trail</h2>
        <p style={sub}>Every dated record from the RC, service book and insurance, in order.</p>
        <Timeline events={r.timeline} breakDates={breakDates} />
      </section>

      <section style={section()} aria-labelledby="iss" data-print="hide">
        <h2 id="iss" style={h2}>{n === 0 ? "No issues found" : `Issues found (${n})`}</h2>
        <p style={sub}>What a careful buyer — or a mechanic — would stop and question.</p>
        {n === 0 ? (
          <div style={{ display: "flex", gap: 10, alignItems: "center", color: "var(--ok)", padding: "14px 0" }}>
            <Check /> The documents are internally consistent.
          </div>
        ) : (
          r.flags.map((f, i) => <FlagCard key={i} flag={f} i={i} />)
        )}
        {r.unreadable_notices.length > 0 && (
          <div style={{ marginTop: 16, fontSize: 13.5, color: "var(--ink-3)" }}>
            {r.unreadable_notices.map((notice, i) => (
              <p key={i} style={{ margin: "4px 0" }}>{notice.message}</p>
            ))}
          </div>
        )}
      </section>

      {activeCosts.length > 0 && (
        <section style={section()} aria-labelledby="cost" data-print="hide">
          <h2 id="cost" style={h2}>What it may cost you next</h2>
          <p style={sub}>Big-ticket parts near the end of their life for a car this age and mileage.</p>
          {activeCosts.map((p, i) => (
            <PartRiskCard key={i} risk={p} />
          ))}
        </section>
      )}

      {r.price_comps.length > 0 && (
        <section style={section()} aria-labelledby="mkt" data-print="hide">
          <h2 id="mkt" style={h2}>Similar cars on the market</h2>
          <p style={sub}>Comparable listings, so you know what this car is really worth.</p>
          <PriceComps comps={r.price_comps} asking={r.car.asking_price_inr} market={r.market} />
        </section>
      )}

      {r.questions.length > 0 && (
        <section style={section()} aria-labelledby="q">
          <h2 id="q" style={h2}>Questions for the seller</h2>
          <QuestionSheet questions={r.questions} carLabel={carLabel} />
        </section>
      )}

      <footer data-print="hide" style={{ marginTop: 56, paddingTop: 16, borderTop: "1px solid var(--hair)", color: "var(--ink-3)", fontSize: 12.5, lineHeight: 1.5 }}>
        Document facts are read from your uploads. Market prices are pulled live from the web via the
        Anakin API. Public-record and challan data use sample sources for this demo car (its registration
        is synthetic); a real registration is scraped live the same way.
      </footer>
    </main>
  );
}
