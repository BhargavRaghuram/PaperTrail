import { describe, it, expect } from "vitest";
import { enrichReport } from "@/lib/scrapers/enrich";
import type { Report } from "@/lib/contracts";

const baseReport = (reg: string, ownerPaper: number): Report => ({
  car: { make: "Maruti", model: "Dzire", year: 2018, reg_number: reg, chassis: "MA3EYD81S00C66452", owner_count_paper: ownerPaper },
  timeline: [{ date: "2018-02-20", type: "registration", odometer_km: 0, source: "rc" }],
  flags: [],
  unreadable_notices: [],
  questions: [],
  part_risks: [],
  price_comps: [],
});

describe("enrichReport (moat via mock fallback)", () => {
  it("flags ownership vs public record for the hero car", async () => {
    const r = await enrichReport(baseReport("KA 99 JD 6645", 2));
    expect(r.flags.some((f) => f.rule === "ownership_mismatch_vs_record" && f.severity === "high")).toBe(true);
    expect(r.car.owner_count_record).toBe(3);
  });

  it("adds challan timeline events and a traffic_violations flag", async () => {
    const r = await enrichReport(baseReport("KA 99 JD 6645", 2));
    expect(r.timeline.some((e) => e.type === "challan")).toBe(true);
    expect(r.flags.some((f) => f.rule === "traffic_violations")).toBe(true);
  });

  it("attaches price comparisons", async () => {
    const r = await enrichReport(baseReport("KA 99 JD 6645", 2));
    expect(r.price_comps.length).toBeGreaterThan(0);
  });

  it("degrades gracefully for an unknown registration", async () => {
    const r = await enrichReport(baseReport("XX00XX0000", 1));
    expect(r.flags.length).toBe(0);
    expect(r.timeline.every((e) => e.type !== "challan")).toBe(true);
  });
});
