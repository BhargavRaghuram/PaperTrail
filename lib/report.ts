import type { CarFacts, Extraction, Report, SellerClaim } from "@/lib/contracts";
import { buildTimeline, reconcile, unreadableNotices, questions } from "@/lib/engine";
import { assessParts } from "@/lib/cost/costEngine";

export function carFactsFrom(ext: Extraction): CarFacts {
  const rc = ext.rc;
  const tl = buildTimeline(ext);
  const lastReading = [...tl].reverse().find((e) => e.odometer_km != null)?.odometer_km ?? undefined;
  const year = rc?.registration_date ? Number(rc.registration_date.slice(0, 4)) : undefined;
  return {
    make: rc?.maker, model: rc?.model, year, fuel: rc?.fuel,
    reg_number: rc?.registration_number, chassis: rc?.chassis_number,
    owner_count_paper: rc?.owner_serial ?? undefined,
    current_odometer_km: lastReading ?? undefined,
  };
}

export function assembleReport(ext: Extraction, seller: SellerClaim): Report {
  const timeline = buildTimeline(ext);
  const flags = reconcile(ext, timeline, seller);
  const car = carFactsFrom(ext);
  return {
    car,
    timeline,
    flags,
    unreadable_notices: unreadableNotices(ext),
    questions: questions(flags),
    part_risks: assessParts(car, timeline),
    price_comps: [], // filled by Task 9 (scrapers)
  };
}
