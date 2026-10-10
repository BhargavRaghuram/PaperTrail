import { describe, it, expect, vi } from "vitest";
import { enrichReport } from "@/lib/scrapers/enrich";
import type { Report } from "@/lib/contracts";

vi.mock("@/lib/scrapers/partPrice", () => ({
  livePartPrice: vi.fn(async (_make: string | undefined, _model: string | undefined, part: string) =>
    part === "Battery" ? 6200 : null,
  ),
}));

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

  it("does not let an unrelated timeline note reclassify a part's status while live-repricing it", async () => {
    // Regression: enrichReport must not re-derive part_risks from a timeline it has already
    // mutated with challan notes — a note that happens to share a word with a part name
    // (e.g. "battery") must not flip that part's status out from under the override price.
    const report: Report = {
      car: { make: "Maruti", model: "Dzire", year: 2016, reg_number: "XX00XX9999", chassis: "X", owner_count_paper: 1, current_odometer_km: 62000 },
      timeline: [
        { date: "2016-01-01", type: "registration", odometer_km: 0, source: "rc" },
        { date: "2024-01-01", type: "challan", source: "public record", note: "Battery disposal violation" },
      ],
      flags: [],
      unreadable_notices: [],
      questions: [],
      part_risks: [
        { part: "Battery", priority: "low", est_cost_inr: 6500, status: "overdue", reason: "test fixture", source: "catalog" },
      ],
      price_comps: [],
    };

    const r = await enrichReport(report);
    const battery = r.part_risks.find((p) => p.part === "Battery")!;
    expect(battery.status).toBe("overdue");
    expect(battery.est_cost_inr).toBe(6200);
    expect(battery.source).toBe("live");
  });
});
