import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import { buildTimeline } from "@/lib/engine";

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
