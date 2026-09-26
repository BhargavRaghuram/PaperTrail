import type { Extraction, Flag, SellerClaim, TLEvent, TLType } from "@/lib/contracts";

const usable = (e: Record<string, any>, field: string) =>
  e[field] != null && !((e.low_confidence_fields ?? []) as string[]).includes(field);

const ORDER: Record<TLType, number> = {
  registration: 0,
  insurance_start: 1,
  service: 2,
  insurance_end: 3,
};

export function buildTimeline(ext: Extraction): TLEvent[] {
  const ev: TLEvent[] = [];

  const rc = ext.rc;
  if (rc && rc.registration_date) {
    ev.push({
      date: rc.registration_date, type: "registration", odometer_km: 0, source: rc.source,
      note: "Odometer assumed 0 at first registration (new vehicle)",
    });
  }

  const sb = ext.service_book;
  if (sb) {
    for (const e of sb.entries) {
      if (!usable(e, "date")) continue;
      ev.push({
        date: e.date as string, type: "service", service_type: e.service_type ?? null,
        odometer_km: usable(e, "odometer_km") ? e.odometer_km : null,
        source: e.source, note: e.notes ?? null,
      });
    }
  }

  for (const p of ext.insurance ?? []) {
    if (p.period_start) ev.push({ date: p.period_start, type: "insurance_start", policy_number: p.policy_number, source: p.source });
    if (p.period_end) ev.push({ date: p.period_end, type: "insurance_end", policy_number: p.policy_number, source: p.source });
  }

  ev.sort((a, b) =>
    a.date < b.date ? -1 : a.date > b.date ? 1 :
    (ORDER[a.type] - ORDER[b.type]) || ((a.odometer_km ?? 0) - (b.odometer_km ?? 0)),
  );
  return ev;
}
