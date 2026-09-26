import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import { assembleReport } from "@/lib/report";

const load = (id: string) => {
  const base = resolve("dataset/papertrail_test_data/scenarios", id);
  return {
    extraction: JSON.parse(readFileSync(resolve(base, "expected/extraction.json"), "utf8")),
    seller: JSON.parse(readFileSync(resolve(base, "seller_claim.json"), "utf8")),
  };
};

describe("assembleReport", () => {
  it("S13 hero: 4 flags, 4 questions, car facts populated", () => {
    const { extraction, seller } = load("S13_multi_flag_demo");
    const r = assembleReport(extraction, seller);
    expect(new Set(r.flags.map((f) => f.rule)).size).toBe(4);
    expect(r.questions.length).toBe(4);
    expect(r.car.reg_number).toBeTruthy();
    expect(r.timeline[0].type).toBe("registration");
  });
});
