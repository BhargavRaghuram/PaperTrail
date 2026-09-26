import type { CarFacts, PartRisk, TLEvent } from "@/lib/contracts";
import seed from "@/data/parts-catalog.json";

export interface CatalogItem {
  part: string;
  category: "high" | "low";
  km_life: number;
  years_life: number;
  cost_min_inr: number;
  cost_max_inr: number;
}

const STATUS_RANK = { overdue: 0, due_soon: 1, ok: 2 } as const;
const PRIO_RANK = { high: 0, low: 1 } as const;

/**
 * Compare each catalog part's service life against the car's real age/mileage.
 * A part named in a service entry's notes/service_type is treated as replaced.
 * `priceOverride` lets a live boodmo lookup (Task 9) substitute a real cost.
 */
export function assessParts(
  car: CarFacts,
  events: TLEvent[],
  catalog: CatalogItem[] = seed as CatalogItem[],
  priceOverride?: Record<string, number>,
): PartRisk[] {
  const age = car.year ? new Date().getFullYear() - car.year : 0;
  const km = car.current_odometer_km ?? 0;

  const replacedText = events
    .flatMap((e) => [e.note, e.service_type])
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  const risks = catalog.map<PartRisk>((c) => {
    const cost = priceOverride?.[c.part] ?? Math.round((c.cost_min_inr + c.cost_max_inr) / 2);
    const replaced = replacedText.includes(c.part.toLowerCase().split(" ")[0]);
    if (replaced) {
      return { part: c.part, priority: c.category, est_cost_inr: cost, status: "ok", reason: "Replacement noted in the service record." };
    }
    const overdue = age >= c.years_life || km >= c.km_life;
    const dueSoon = age >= c.years_life * 0.8 || km >= c.km_life * 0.8;
    const status: PartRisk["status"] = overdue ? "overdue" : dueSoon ? "due_soon" : "ok";
    const reason = overdue
      ? `At ${age} years / ${km.toLocaleString("en-IN")} km this is past a typical ~${c.years_life}-year, ${c.km_life.toLocaleString("en-IN")}-km life, with no replacement on record.`
      : dueSoon
        ? `Approaching the end of its typical ~${c.years_life}-year, ${c.km_life.toLocaleString("en-IN")}-km life.`
        : "Within expected service life.";
    return { part: c.part, priority: c.category, est_cost_inr: cost, status, reason };
  });

  return risks.sort(
    (a, b) =>
      STATUS_RANK[a.status] - STATUS_RANK[b.status] ||
      PRIO_RANK[a.priority] - PRIO_RANK[b.priority] ||
      b.est_cost_inr - a.est_cost_inr,
  );
}
