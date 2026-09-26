import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import { buildTimeline, reconcile, unreadableNotices, questions } from "@/lib/engine";

const FIX = JSON.parse(
  readFileSync(resolve("dataset/papertrail_test_data/fixtures/all_scenarios.json"), "utf8"),
) as any[];

describe("buildTimeline", () => {
  for (const sc of FIX) {
    it(`${sc.id}: timeline is date-sorted`, () => {
      const tl = buildTimeline(sc.extraction);
      const dates = tl.map((e) => e.date);
      expect(dates).toEqual([...dates].sort());
    });
  }
});

describe("reconcile matches the oracle", () => {
  for (const sc of FIX) {
    it(`${sc.id}: fires exactly ${JSON.stringify(sc.expected_rules)}`, () => {
      const tl = buildTimeline(sc.extraction);
      const flags = reconcile(sc.extraction, tl, sc.seller_claim);
      const rules = [...new Set(flags.map((f) => f.rule))].sort();
      expect(rules).toEqual(sc.expected_rules);
    });
  }
});

describe("notices + questions", () => {
  for (const sc of FIX) {
    it(`${sc.id}: ${sc.expected_unreadable} unreadable notice(s)`, () => {
      expect(unreadableNotices(sc.extraction).length).toBe(sc.expected_unreadable);
    });
  }
  it("S13 yields four seller questions", () => {
    const sc = FIX.find((s) => s.id === "S13_multi_flag_demo");
    const tl = buildTimeline(sc.extraction);
    const qs = questions(reconcile(sc.extraction, tl, sc.seller_claim));
    expect(qs.length).toBe(4);
  });
});
