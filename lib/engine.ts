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

const JUMP = 150, GAP_DAYS = 365, GAP_KM = 15000, MIN_SVC = 2;
const D = (s: string) => Date.parse(s + "T00:00:00Z");
const daysBetween = (a: string, b: string) => Math.round((D(b) - D(a)) / 86_400_000);
const normId = (s?: string | null) => (s ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");

export function reconcile(ext: Extraction, timeline: TLEvent[], seller: SellerClaim): Flag[] {
  const flags: Flag[] = [];

  const readings = timeline.filter((e) => e.odometer_km != null);
  for (let i = 1; i < readings.length; i++) {
    const a = readings[i - 1], b = readings[i];
    const days = daysBetween(a.date, b.date);
    const ka = a.odometer_km as number, kb = b.odometer_km as number;
    const diff = kb - ka;
    if (diff < 0) {
      const f: Flag = {
        rule: "odometer_regression", severity: "high", entries: [a.date, b.date],
        values_km: [ka, kb], sources: [a.source, b.source],
        explanation: `Mileage decreased from ${ka.toLocaleString()} km to ${kb.toLocaleString()} km between two dated records.`,
      };
      if (b.note) f.context = b.note;
      flags.push(f);
    } else if (diff / Math.max(days, 1) > JUMP) {
      flags.push({
        rule: "implausible_mileage_jump", severity: "medium", entries: [a.date, b.date],
        values_km: [ka, kb], days, km_per_day: Math.round((diff / Math.max(days, 1)) * 10) / 10,
        explanation: `${diff.toLocaleString()} km in ${days} days (~${Math.round(diff / Math.max(days, 1))} km/day) exceeds the ${JUMP} km/day threshold.`,
      });
    }
  }

  const services = timeline.filter((e) => e.type === "service");
  for (let i = 1; i < services.length; i++) {
    const a = services[i - 1], b = services[i];
    const days = daysBetween(a.date, b.date);
    const km = (a.odometer_km != null && b.odometer_km != null) ? (b.odometer_km - a.odometer_km) : null;
    const reasons: string[] = [];
    if (days > GAP_DAYS) reasons.push(`${days} days (> ${GAP_DAYS})`);
    if (km != null && km > GAP_KM) reasons.push(`${km.toLocaleString()} km (> ${GAP_KM.toLocaleString()})`);
    if (reasons.length) {
      flags.push({
        rule: "service_gap", severity: "medium", entries: [a.date, b.date],
        gap_days: days, gap_km: km, explanation: "Gap between services: " + reasons.join(" and ") + ".",
      });
    }
  }

  const pol = (ext.insurance ?? []).slice().sort((x, y) => (x.period_start! < y.period_start! ? -1 : 1));
  for (let i = 1; i < pol.length; i++) {
    const a = pol[i - 1], b = pol[i];
    const gap = daysBetween(a.period_end as string, b.period_start as string) - 1;
    if (gap > 0) {
      flags.push({
        rule: "insurance_lapse", severity: "medium", entries: [a.period_end!, b.period_start!],
        uninsured_days: gap, policies: [a.policy_number, b.policy_number],
        explanation: `No insurance cover for ${gap} days between consecutive policies.`,
      });
    }
  }

  const rc = ext.rc;
  if (rc && seller.claimed_owners != null && rc.owner_serial != null && rc.owner_serial !== seller.claimed_owners) {
    flags.push({
      rule: "ownership_mismatch", severity: "high", rc_owner_serial: rc.owner_serial,
      seller_claimed_owners: seller.claimed_owners,
      explanation: `RC owner serial number is ${rc.owner_serial} but the seller claims ${seller.claimed_owners} owner(s).`,
    });
  }

  if (services.length < MIN_SVC) {
    flags.push({
      rule: "missing_service_history", severity: "low", dated_entries: services.length,
      explanation: "No maintenance record available — treat as unverified.",
    });
  }

  if (rc) {
    const docs: any[] = [ext.service_book, ...(ext.insurance ?? [])].filter(Boolean);
    for (const doc of docs) {
      for (const fld of ["registration_number", "chassis_number"]) {
        const v = "vehicle" in doc ? doc.vehicle?.[fld] : doc[fld];
        if (v && normId(v) !== normId((rc as any)[fld])) {
          flags.push({
            rule: "document_identity_mismatch", severity: "high", field: fld,
            document: doc.source ?? doc.document_type, rc_value: (rc as any)[fld], document_value: v,
            explanation: `${fld} on ${doc.document_type} (${v}) does not match RC (${(rc as any)[fld]}).`,
          });
        }
      }
    }
  }

  return flags;
}

export function unreadableNotices(ext: Extraction) {
  const out: { source: string; field: string; message: string }[] = [];
  for (const e of ext.service_book?.entries ?? []) {
    for (const f of e.low_confidence_fields ?? []) {
      out.push({
        source: e.source, field: f,
        message: `${e.source} contains an unreadable ${f.replace(/_/g, " ")}. Please retake the photo.`,
      });
    }
  }
  return out;
}

const Q: Record<string, string> = {
  odometer_regression: "Can you explain why the recorded mileage went down between {a} and {b}?",
  implausible_mileage_jump: "The car appears to have covered {km} km in {days} days between {a} and {b}. Can you explain this usage?",
  service_gap: "What happened during the gap in service history between {a} and {b}?",
  insurance_lapse: "Why was the car uninsured between {a} and {b}? Was it involved in any incident during that period?",
  ownership_mismatch: "The RC shows this is owner no. {rc}. Can you clarify how many previous owners the car has had?",
  missing_service_history: "Can you share any service invoices or job cards, since the service book has fewer than 2 dated entries?",
  document_identity_mismatch: "The {field} on the {doc} does not match the RC. Is this document for the same car?",
};

export function questions(flags: Flag[]) {
  const qs: { rule: string; question: string }[] = [];
  const seen = new Set<string>();
  for (const f of flags) {
    const r = f.rule;
    let key = "";
    let q = "";
    if (r === "document_identity_mismatch") {
      key = `${r}|${f.document}`;
      q = Q[r].replace("{field}", String(f.field).replace(/_/g, " ")).replace("{doc}", String(f.document));
    } else if (r === "ownership_mismatch") {
      key = r;
      q = Q[r].replace("{rc}", String(f.rc_owner_serial));
    } else if (r === "missing_service_history") {
      key = r;
      q = Q[r];
    } else if (r === "implausible_mileage_jump") {
      const [a, b] = (f.entries as string[]) ?? ["", ""];
      const vk = f.values_km as number[];
      key = `${r}|${a}|${b}`;
      q = Q[r].replace("{km}", (vk[1] - vk[0]).toLocaleString()).replace("{days}", String(f.days)).replace("{a}", a).replace("{b}", b);
    } else {
      const [a, b] = (f.entries as string[]) ?? ["", ""];
      key = `${r}|${a}|${b}`;
      q = (Q[r] ?? "").replace("{a}", a).replace("{b}", b);
    }
    if (seen.has(key)) continue;
    seen.add(key);
    qs.push({ rule: r, question: q });
  }
  return qs;
}
