import { describe, it, expect } from "vitest";
import { assessParts } from "@/lib/cost/costEngine";
import type { CarFacts, TLEvent } from "@/lib/contracts";

const car: CarFacts = { year: 2016, current_odometer_km: 62000 };

describe("assessParts", () => {
  it("marks the alternator overdue/near-life for an old high-km car, with a cost", () => {
    const risks = assessParts(car, []);
    const alt = risks.find((r) => r.part === "Alternator");
    expect(alt).toBeTruthy();
    expect(alt!.est_cost_inr).toBeGreaterThan(0);
    expect(alt!.status).not.toBe("ok");
  });

  it("sorts overdue high-priority parts first", () => {
    const risks = assessParts(car, []);
    expect(risks[0].status).toBe("overdue");
  });

  it("does not flag a part named as replaced in the service record", () => {
    const events: TLEvent[] = [
      { date: "2023-01-01", type: "service", source: "sb", note: "Battery replaced under warranty" },
    ];
    const risks = assessParts(car, events);
    expect(risks.find((r) => r.part === "Battery")!.status).toBe("ok");
  });

  it("honours a live price override", () => {
    const risks = assessParts(car, [], undefined, { Alternator: 12500 });
    expect(risks.find((r) => r.part === "Alternator")!.est_cost_inr).toBe(12500);
  });
});
