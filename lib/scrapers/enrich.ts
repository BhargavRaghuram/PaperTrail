import type { Report } from "@/lib/contracts";
import { anakinRun, normReg } from "./anakin";
import { MOCK_RECORDS, MOCK_CHALLANS, priceCompsFor, type Challan, type PublicRecord } from "./mockData";
import { questions } from "@/lib/engine";

async function getRecord(reg: string): Promise<PublicRecord | null> {
  const live = await anakinRun(process.env.ANAKIN_VAHAN_APP_ID, { registration: reg });
  if (live && live.owner_count_record != null) return live as PublicRecord;
  return MOCK_RECORDS[normReg(reg)] ?? null;
}

async function getChallans(reg: string): Promise<Challan[]> {
  const live = await anakinRun(process.env.ANAKIN_CHALLAN_APP_ID, { registration: reg });
  if (live && Array.isArray(live.challans)) return live.challans as Challan[];
  return MOCK_CHALLANS[normReg(reg)] ?? [];
}

/**
 * Cross-checks the documents against live public data (Anakin) or bundled mocks.
 * Runs only in /api/verify, after assembleReport — never touches the 13-scenario oracle.
 */
export async function enrichReport(report: Report): Promise<Report> {
  const car = report.car;
  const reg = car.reg_number;
  if (!reg) return report;

  const [record, challans] = await Promise.all([getRecord(reg), getChallans(reg)]);

  if (record) {
    car.owner_count_record = record.owner_count_record;
    if (car.owner_count_paper != null && record.owner_count_record !== car.owner_count_paper) {
      report.flags.push({
        rule: "ownership_mismatch_vs_record",
        severity: "high",
        entries: [`documents: ${car.owner_count_paper}`, `public record: ${record.owner_count_record}`],
        evidence_source: "public_record",
        explanation: `The documents show ${car.owner_count_paper} owner(s), but the public vehicle record shows ${record.owner_count_record}. A seller can edit paper — they cannot edit the government record.`,
      });
    }
    if (record.chassis && car.chassis && normReg(record.chassis) !== normReg(car.chassis)) {
      report.flags.push({
        rule: "identity_mismatch_vs_record",
        severity: "high",
        entries: [car.chassis, record.chassis],
        evidence_source: "public_record",
        explanation: `The public record's chassis (${record.chassis}) does not match the documents (${car.chassis}). These papers may describe a different vehicle.`,
      });
    }
  }

  if (challans.length) {
    for (const c of challans) {
      report.timeline.push({ date: c.date, type: "challan", source: "public record", note: c.offence });
    }
    report.timeline.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    const total = challans.reduce((s, c) => s + (c.amount_inr || 0), 0);
    report.flags.push({
      rule: "traffic_violations",
      severity: "medium",
      entries: challans.map((c) => c.date),
      evidence_source: "public_record",
      explanation: `${challans.length} traffic violation${challans.length > 1 ? "s" : ""} on record (₹${total.toLocaleString("en-IN")} in challans), including over-speeding.`,
    });
  }

  report.price_comps = priceCompsFor(car.make, car.model);
  report.questions = questions(report.flags);
  return report;
}
