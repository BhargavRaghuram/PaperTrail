# PaperTrail Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Next.js web app where a used-car buyer uploads a car's documents and gets a visual timeline, ranked sourced flags (odometer, ownership, challans), a hidden-cost forecast, and a printable seller-question sheet — the document engine cross-checked against live scraped public data.

**Architecture:** Next.js App Router (frontend + API routes = backend) on Vercel, no database, session in memory. The deterministic reconciliation engine is a **faithful TypeScript port of the reference engine** the team already validated (`dataset/papertrail_test_data/reference/engine.py`), tested against all 13 scenarios. Claude does vision extraction + a narrative reasoning pass. Anakin scrapers add enrichment pillars that never alter the 13-scenario rule-sets and degrade gracefully.

**Tech Stack:** Next.js (App Router, TypeScript), Vitest, `@anthropic-ai/sdk`, Framer Motion, Vercel.

**Spec:** `docs/superpowers/specs/2026-09-26-papertrail-design.md`
**Authoritative rule contract (supersedes the spec where they differ):** `dataset/papertrail_test_data/` — `reference/engine.py` (rules), `schemas/extraction.schema.json` (extraction shape), `fixtures/all_scenarios.json` + `scenarios/*/expected/report.json` (oracle), `README.md` (rule parameters).

## Global Constraints

- Node 24 / npm 11. Next.js App Router + TypeScript. All money in INR (₹).
- No database, no auth, no persistence. Session state in memory / React state only.
- Claude key is in `.env` as `CLAUDE_API` (stray trailing space in the key name). All Anthropic calls go through `lib/claude.ts`, which reads `process.env.CLAUDE_API` (trimmed) and passes it explicitly to the SDK. Anakin key is `ANAKIN_API` in `.env`.
- Anthropic model: `claude-opus-4-8` (vision + reasoning). `claude-sonnet-5` is the faster fallback if live latency hurts.
- **The reference engine is the oracle.** Confidence is 3-level (`high|medium|low`). A field is "usable" only if non-null AND not listed in that record's `low_confidence_fields`. Service gaps use **strictly greater** (`> 365` days, `> 15000` km) so S11 (exactly on both limits) does NOT fire. Insurance lapse fires when `(next.period_start - prev.period_end).days - 1 > 0`. Ownership mismatch compares `rc.owner_serial` vs `seller_claim.claimed_owners`. Registration is odometer 0. Rule names exactly: `odometer_regression`, `implausible_mileage_jump`, `service_gap`, `insurance_lapse`, `ownership_mismatch`, `missing_service_history`, `document_identity_mismatch`.
- Enrichment pillars (challans, cost-of-ownership, price comparison, ownership/identity-vs-public-record) are **additive**: they must never change the rule-set produced for the 13 document scenarios. Every scraper degrades gracefully — on any failure it returns empty/"unavailable" and never throws into the request path.
- Ponytail: no speculative abstraction, no single risk score, no forgery detection, no SSE (client-side staged reveal). One engine module + one contract; enrichment lives in separate isolated modules.
- Build order is strict; each layer is a standalone demo. **The hero demo is S13** (four flags, images already exist) — no demo images to generate.
- **Vercel runtime rules:** never read `dataset/` (or any repo file) with `fs` inside a route/page — those files aren't in the serverless bundle; use static `import` of JSON so it's bundled. Keep each API request body under ~4.5 MB (resize images client-side, one image per extract call). `fs` reads are fine in Vitest tests (they run locally/CI).

---

## File Structure

```
lib/contracts.ts            extraction + timeline + flag + report types (mirror the schema)
lib/engine.ts               PORT of reference/engine.py: buildTimeline, reconcile, unreadableNotices, questions
lib/report.ts               assembleReport(extraction, seller) -> Report (+ enrichment merge points)
lib/claude.ts               Anthropic client (maps CLAUDE_API)
lib/cost/costEngine.ts      parts lifetime vs car facts (enrichment)
lib/scrapers/anakin.ts      base adapter (graceful)
lib/scrapers/vahan.ts       ownership/identity vs public record (moat)
lib/scrapers/challan.ts     traffic violations
lib/scrapers/parts.ts       boodmo part pricing
lib/scrapers/price.ts       Cars24/Spinny comps
data/parts-catalog.json     seed catalog (lifetime + cost)
app/page.tsx                upload + seller-claim
app/report/page.tsx         event-driven staged report
app/api/extract/route.ts    Claude vision -> extraction JSON (schema-shaped)
app/api/verify/route.ts     extraction + seller -> Report (+ scrapers)
components/Timeline.tsx FlagCard.tsx PartRiskCard.tsx PriceComps.tsx QuestionSheet.tsx
tests/engine.test.ts        runs the port against all 13 scenarios (the reliability gate)
tests/cost.test.ts scrapers.test.ts
```

Test fixtures are read from `dataset/papertrail_test_data/` (Vitest runs from repo root).

---

## Task 0: Scaffold app, test runner, contracts

**Files:** create `package.json`, `tsconfig.json`, `vitest.config.ts` (via create-next-app); create `lib/contracts.ts`; modify `.gitignore`.

**Interfaces:**
- Produces all shared types mirroring `schemas/extraction.schema.json`: `Confidence`, `RC`, `ServiceEntry`, `ServiceBook`, `Insurance`, `Extraction`, `SellerClaim`, `TLEvent`, `Flag`, `CarFacts`, `PartRisk`, `PriceComp`, `Report`.

- [ ] **Step 1: Scaffold Next.js at repo root**

Run (repo root `D:\The One`):
```bash
npx create-next-app@latest . --ts --app --no-src-dir --no-tailwind --eslint --use-npm --yes
```
If it refuses due to existing files, scaffold into `app-tmp/` and move `app/`, `package.json`, `tsconfig.json`, `next.config.*`, `public/` to root.

- [ ] **Step 2: Deps + scripts + config**

```bash
npm i -D vitest @vitejs/plugin-react
npm i @anthropic-ai/sdk framer-motion
```
Create `vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";
import { resolve } from "path";
export default defineConfig({
  resolve: { alias: { "@": resolve(__dirname, ".") } },
  test: { environment: "node", include: ["tests/**/*.test.ts"] },
});
```
Add `package.json` scripts: `"test": "vitest run"`, `"test:watch": "vitest"`. Ensure `tsconfig.json` has `"resolveJsonModule": true` and `"paths": { "@/*": ["./*"] }`.

- [ ] **Step 3: .gitignore**

Append:
```
/node_modules
/.next
/out
*.tsbuildinfo
```

- [ ] **Step 4: Contracts (mirror the extraction schema)**

Create `lib/contracts.ts`:
```ts
export type Confidence = "high" | "medium" | "low";

export interface RC {
  document_type: "rc"; source: string;
  registration_number: string; registration_date: string | null;
  chassis_number: string; engine_number?: string; owner_name?: string;
  owner_serial: number | null; maker?: string; model?: string; fuel?: string;
  financier?: string | null; confidence: Confidence; low_confidence_fields?: string[];
  [k: string]: unknown;
}
export interface ServiceEntry {
  date: string | null; odometer_km: number | null; service_type?: string | null;
  dealer?: string | null; source: string; confidence: Confidence;
  low_confidence_fields?: string[]; notes?: string | null;
}
export interface ServiceBook {
  document_type: "service_book";
  vehicle?: { registration_number?: string | null; chassis_number?: string | null; date_of_sale?: string | null; source?: string };
  entries: ServiceEntry[];
}
export interface Insurance {
  document_type: "insurance"; source: string; policy_number: string; insurer?: string;
  registration_number?: string; chassis_number?: string;
  period_start: string | null; period_end: string | null;
  ncb_percent?: number | null; previous_policy_number?: string | null;
  confidence: Confidence; low_confidence_fields?: string[];
}
export interface Extraction { rc: RC | null; service_book: ServiceBook | null; insurance: Insurance[]; }
export interface SellerClaim { claimed_owners: number | null; raw_text?: string; }

export type TLType = "registration" | "service" | "insurance_start" | "insurance_end";
export interface TLEvent {
  date: string; type: TLType; odometer_km?: number | null; source: string;
  note?: string | null; service_type?: string | null; policy_number?: string;
}

export interface Flag {
  rule: string; severity: "high" | "medium" | "low";
  entries?: string[]; explanation: string;
  [k: string]: unknown; // rule-specific: values_km, sources, gap_days, gap_km, uninsured_days, policies, context, ...
}

export interface CarFacts {
  make?: string; model?: string; year?: number; fuel?: string;
  reg_number?: string; chassis?: string;
  owner_count_paper?: number; owner_count_record?: number;
  current_odometer_km?: number; asking_price_inr?: number;
}
export interface PartRisk {
  part: string; priority: "high" | "low"; est_cost_inr: number;
  status: "overdue" | "due_soon" | "ok"; reason: string;
}
export interface PriceComp { source: string; title: string; price_inr: number; url: string; }

export interface Report {
  car: CarFacts;
  timeline: TLEvent[];
  flags: Flag[];
  unreadable_notices: { source: string; field: string; message: string }[];
  questions: { rule: string; question: string }[];
  part_risks: PartRisk[];
  price_comps: PriceComp[];
}
```

- [ ] **Step 5: Verify + commit**

Run `npm run build` (expect success) and `npm test` (expect "No test files found"). Then:
```bash
git add -A && git commit -m "chore: scaffold PaperTrail app + contracts mirroring extraction schema"
```

---

## Task 1: Port the Timeline Builder (from reference/engine.py)

**Files:** create `lib/engine.ts` (timeline section); test `tests/engine.test.ts` (timeline part).

**Interfaces:**
- Consumes: `Extraction`.
- Produces: `buildTimeline(ext: Extraction): TLEvent[]` — registration (odo 0) + usable-dated service entries (odo null if odometer not usable) + insurance start/end, sorted by `(date, typeOrder, odometer)`.

- [ ] **Step 1: Write the failing test (timeline sorted for ALL scenarios)**

Create `tests/engine.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import { buildTimeline } from "@/lib/engine";

const FIX = JSON.parse(readFileSync(resolve("dataset/papertrail_test_data/fixtures/all_scenarios.json"), "utf8")) as any[];

describe("buildTimeline", () => {
  for (const sc of FIX) {
    it(`${sc.id}: timeline is date-sorted`, () => {
      const tl = buildTimeline(sc.extraction);
      const dates = tl.map(e => e.date);
      expect(dates).toEqual([...dates].sort());
    });
  }
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/engine.test.ts` — Expected: FAIL (module missing).

- [ ] **Step 3: Implement buildTimeline**

Create `lib/engine.ts`:
```ts
import type { Extraction, Flag, SellerClaim, TLEvent, TLType } from "@/lib/contracts";

const usable = (e: Record<string, any>, field: string) =>
  e[field] != null && !((e.low_confidence_fields ?? []) as string[]).includes(field);

const ORDER: Record<TLType, number> = { registration: 0, insurance_start: 1, service: 2, insurance_end: 3 };

export function buildTimeline(ext: Extraction): TLEvent[] {
  const ev: TLEvent[] = [];
  const rc = ext.rc;
  if (rc && rc.registration_date) {
    ev.push({ date: rc.registration_date, type: "registration", odometer_km: 0, source: rc.source,
      note: "Odometer assumed 0 at first registration (new vehicle)" });
  }
  const sb = ext.service_book;
  if (sb) {
    for (const e of sb.entries) {
      if (!usable(e, "date")) continue;
      ev.push({ date: e.date as string, type: "service", service_type: e.service_type ?? null,
        odometer_km: usable(e, "odometer_km") ? e.odometer_km : null, source: e.source, note: e.notes ?? null });
    }
  }
  for (const p of ext.insurance ?? []) {
    if (p.period_start) ev.push({ date: p.period_start, type: "insurance_start", policy_number: p.policy_number, source: p.source });
    if (p.period_end) ev.push({ date: p.period_end, type: "insurance_end", policy_number: p.policy_number, source: p.source });
  }
  ev.sort((a, b) =>
    a.date < b.date ? -1 : a.date > b.date ? 1 :
    (ORDER[a.type] - ORDER[b.type]) || ((a.odometer_km ?? 0) - (b.odometer_km ?? 0))
  );
  return ev;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run tests/engine.test.ts` — Expected: PASS (13 timeline tests).

- [ ] **Step 5: Commit**

```bash
git add lib/engine.ts tests/engine.test.ts
git commit -m "feat: port timeline builder, passes all 13 scenarios"
```

---

## Task 2: Port the 7 reconciliation rules (the reliability core)

**Files:** modify `lib/engine.ts` (add `reconcile`); extend `tests/engine.test.ts`.

**Interfaces:**
- Consumes: `Extraction`, `TLEvent[]`, `SellerClaim`.
- Produces: `reconcile(ext, timeline, seller): Flag[]` reproducing the reference exactly. The test asserts `sorted(unique rule names) === scenario.expected_rules` for all 13.

- [ ] **Step 1: Write the failing test (rule-sets for ALL 13 scenarios)**

Append to `tests/engine.test.ts`:
```ts
import { reconcile } from "@/lib/engine";

describe("reconcile matches the oracle", () => {
  for (const sc of FIX) {
    it(`${sc.id}: fires exactly ${JSON.stringify(sc.expected_rules)}`, () => {
      const tl = buildTimeline(sc.extraction);
      const flags = reconcile(sc.extraction, tl, sc.seller_claim);
      const rules = [...new Set(flags.map(f => f.rule))].sort();
      expect(rules).toEqual(sc.expected_rules);
    });
  }
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/engine.test.ts` — Expected: FAIL (`reconcile` not exported).

- [ ] **Step 3: Implement reconcile (faithful port)**

Append to `lib/engine.ts`:
```ts
const JUMP = 150, GAP_DAYS = 365, GAP_KM = 15000, MIN_SVC = 2;
const D = (s: string) => Date.parse(s + "T00:00:00Z");
const daysBetween = (a: string, b: string) => Math.round((D(b) - D(a)) / 86_400_000);
const normId = (s?: string | null) => (s ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");

export function reconcile(ext: Extraction, timeline: TLEvent[], seller: SellerClaim): Flag[] {
  const flags: Flag[] = [];

  const readings = timeline.filter(e => e.odometer_km != null);
  for (let i = 1; i < readings.length; i++) {
    const a = readings[i - 1], b = readings[i];
    const days = daysBetween(a.date, b.date);
    const ka = a.odometer_km as number, kb = b.odometer_km as number;
    const diff = kb - ka;
    if (diff < 0) {
      const f: Flag = { rule: "odometer_regression", severity: "high", entries: [a.date, b.date],
        values_km: [ka, kb], sources: [a.source, b.source],
        explanation: `Mileage decreased from ${ka.toLocaleString()} km to ${kb.toLocaleString()} km between two dated records.` };
      if (b.note) f.context = b.note;
      flags.push(f);
    } else if (diff / Math.max(days, 1) > JUMP) {
      flags.push({ rule: "implausible_mileage_jump", severity: "medium", entries: [a.date, b.date],
        values_km: [ka, kb], days, km_per_day: Math.round((diff / Math.max(days, 1)) * 10) / 10,
        explanation: `${diff.toLocaleString()} km in ${days} days (~${Math.round(diff / Math.max(days, 1))} km/day) exceeds the ${JUMP} km/day threshold.` });
    }
  }

  const services = timeline.filter(e => e.type === "service");
  for (let i = 1; i < services.length; i++) {
    const a = services[i - 1], b = services[i];
    const days = daysBetween(a.date, b.date);
    const km = (a.odometer_km != null && b.odometer_km != null) ? (b.odometer_km - a.odometer_km) : null;
    const reasons: string[] = [];
    if (days > GAP_DAYS) reasons.push(`${days} days (> ${GAP_DAYS})`);
    if (km != null && km > GAP_KM) reasons.push(`${km.toLocaleString()} km (> ${GAP_KM.toLocaleString()})`);
    if (reasons.length) flags.push({ rule: "service_gap", severity: "medium", entries: [a.date, b.date],
      gap_days: days, gap_km: km, explanation: "Gap between services: " + reasons.join(" and ") + "." });
  }

  const pol = (ext.insurance ?? []).slice().sort((x, y) => (x.period_start! < y.period_start! ? -1 : 1));
  for (let i = 1; i < pol.length; i++) {
    const a = pol[i - 1], b = pol[i];
    const gap = daysBetween(a.period_end as string, b.period_start as string) - 1;
    if (gap > 0) flags.push({ rule: "insurance_lapse", severity: "medium", entries: [a.period_end!, b.period_start!],
      uninsured_days: gap, policies: [a.policy_number, b.policy_number],
      explanation: `No insurance cover for ${gap} days between consecutive policies.` });
  }

  const rc = ext.rc;
  if (rc && seller.claimed_owners != null && rc.owner_serial != null && rc.owner_serial !== seller.claimed_owners) {
    flags.push({ rule: "ownership_mismatch", severity: "high", rc_owner_serial: rc.owner_serial,
      seller_claimed_owners: seller.claimed_owners,
      explanation: `RC owner serial number is ${rc.owner_serial} but the seller claims ${seller.claimed_owners} owner(s).` });
  }

  if (services.length < MIN_SVC) {
    flags.push({ rule: "missing_service_history", severity: "low", dated_entries: services.length,
      explanation: "No maintenance record available — treat as unverified." });
  }

  if (rc) {
    const docs: any[] = [ext.service_book, ...(ext.insurance ?? [])].filter(Boolean);
    for (const doc of docs) {
      for (const fld of ["registration_number", "chassis_number"]) {
        const v = "vehicle" in doc ? doc.vehicle?.[fld] : doc[fld];
        if (v && normId(v) !== normId((rc as any)[fld])) {
          flags.push({ rule: "document_identity_mismatch", severity: "high", field: fld,
            document: doc.source ?? doc.document_type, rc_value: (rc as any)[fld], document_value: v,
            explanation: `${fld} on ${doc.document_type} (${v}) does not match RC (${(rc as any)[fld]}).` });
        }
      }
    }
  }
  return flags;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run tests/engine.test.ts` — Expected: PASS (all 13 rule-set assertions). **This is the reliability gate — do not proceed until green.**

- [ ] **Step 5: Commit**

```bash
git add lib/engine.ts tests/engine.test.ts
git commit -m "feat: port 7 reconciliation rules, matches oracle on all 13 scenarios"
```

---

## Task 3: Port unreadable-notices + question generator

**Files:** modify `lib/engine.ts`; extend `tests/engine.test.ts`.

**Interfaces:**
- Produces: `unreadableNotices(ext): {source,field,message}[]` and `questions(flags): {rule,question}[]`.
- Test: `unreadableNotices(ext).length === scenario.expected_unreadable` for all 13; and S13 produces 4 questions, S12's question mentions the two dates.

- [ ] **Step 1: Write the failing test**

Append to `tests/engine.test.ts`:
```ts
import { unreadableNotices, questions } from "@/lib/engine";

describe("notices + questions", () => {
  for (const sc of FIX) {
    it(`${sc.id}: ${sc.expected_unreadable} unreadable notice(s)`, () => {
      expect(unreadableNotices(sc.extraction).length).toBe(sc.expected_unreadable);
    });
  }
  it("S13 yields four seller questions", () => {
    const sc = FIX.find(s => s.id === "S13_multi_flag_demo");
    const tl = buildTimeline(sc.extraction);
    const qs = questions(reconcile(sc.extraction, tl, sc.seller_claim));
    expect(qs.length).toBe(4);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/engine.test.ts` — Expected: FAIL.

- [ ] **Step 3: Implement**

Append to `lib/engine.ts`:
```ts
export function unreadableNotices(ext: Extraction) {
  const out: { source: string; field: string; message: string }[] = [];
  for (const e of ext.service_book?.entries ?? []) {
    for (const f of e.low_confidence_fields ?? []) {
      out.push({ source: e.source, field: f, message: `${e.source} contains an unreadable ${f.replace(/_/g, " ")}. Please retake the photo.` });
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
    const r = f.rule; let key = ""; let q = "";
    if (r === "document_identity_mismatch") {
      key = `${r}|${f.document}`;
      q = Q[r].replace("{field}", String(f.field).replace(/_/g, " ")).replace("{doc}", String(f.document));
    } else if (r === "ownership_mismatch") {
      key = r; q = Q[r].replace("{rc}", String(f.rc_owner_serial));
    } else if (r === "missing_service_history") {
      key = r; q = Q[r];
    } else if (r === "implausible_mileage_jump") {
      const [a, b] = f.entries as string[]; const vk = f.values_km as number[];
      key = `${r}|${a}|${b}`;
      q = Q[r].replace("{km}", (vk[1] - vk[0]).toLocaleString()).replace("{days}", String(f.days)).replace("{a}", a).replace("{b}", b);
    } else {
      const [a, b] = (f.entries as string[]) ?? ["", ""];
      key = `${r}|${a}|${b}`;
      q = (Q[r] ?? "").replace("{a}", a).replace("{b}", b);
    }
    if (seen.has(key)) continue;
    seen.add(key); qs.push({ rule: r, question: q });
  }
  return qs;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run tests/engine.test.ts` — Expected: PASS (all suites).

- [ ] **Step 5: Commit**

```bash
git add lib/engine.ts tests/engine.test.ts
git commit -m "feat: port unreadable notices + question generator"
```

---

## Task 4: Report assembler + hero (S13)

**Files:** create `lib/report.ts`; test `tests/report.test.ts`.

**Interfaces:**
- Produces: `carFactsFrom(ext): CarFacts` and `assembleReport(ext, seller): Report` (timeline + flags + notices + questions + `part_risks` (Task 8, empty for now) + `price_comps` (empty)). Also `loadScenario(id): {extraction, seller_claim}` reading the dataset for the hero and demos.

- [ ] **Step 1: Write the failing test**

Create `tests/report.test.ts`:
```ts
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
    expect(new Set(r.flags.map(f => f.rule)).size).toBe(4);
    expect(r.questions.length).toBe(4);
    expect(r.car.reg_number).toBeTruthy();
    expect(r.timeline[0].type).toBe("registration");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/report.test.ts` — Expected: FAIL.

- [ ] **Step 3: Implement**

Create `lib/report.ts`:
```ts
import type { CarFacts, Extraction, Report, SellerClaim } from "@/lib/contracts";
import { buildTimeline, reconcile, unreadableNotices, questions } from "@/lib/engine";

export function carFactsFrom(ext: Extraction): CarFacts {
  const rc = ext.rc;
  const tl = buildTimeline(ext);
  const lastReading = [...tl].reverse().find(e => e.odometer_km != null)?.odometer_km ?? undefined;
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
  return {
    car: carFactsFrom(ext),
    timeline, flags,
    unreadable_notices: unreadableNotices(ext),
    questions: questions(flags),
    part_risks: [],   // filled by Task 8
    price_comps: [],  // filled by Task 9
  };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run tests/report.test.ts` — Expected: PASS. Then `npm test` — all green.

- [ ] **Step 5: Commit**

```bash
git add lib/report.ts tests/report.test.ts
git commit -m "feat: report assembler + S13 hero coverage"
```

---

## Task 5: Report UI on hero data (Layer 0 safety net)

**Files:** create `components/Timeline.tsx`, `FlagCard.tsx`, `PartRiskCard.tsx`, `QuestionSheet.tsx`; create `app/report/page.tsx`; a server helper `app/report/heroData.ts` that reads S13 via `assembleReport` at build/request time.

**Interfaces:** consumes `Report`. Route `/report` renders the hero `Report` with staged reveal (timeline → flags → hidden costs → questions).

> Apply **emil-design-eng** (type scale, spacing, contrast, the odometer-break emphasis) and **animate** (timeline draw-in, staggered cards, the regression reveal) using `framer-motion`. Legible on a projector in 2 minutes.

- [ ] **Step 1: Hero data loader (bundled import — Vercel-safe)**

Do NOT read the fixture with `fs` at request time — files under `dataset/` are not traced into the Vercel serverless bundle and the deployed `/report` would 500. Use a static JSON import so the data is bundled at build (requires `"resolveJsonModule": true`):

Create `app/report/heroData.ts`:
```ts
import extraction from "@/dataset/papertrail_test_data/scenarios/S13_multi_flag_demo/expected/extraction.json";
import seller from "@/dataset/papertrail_test_data/scenarios/S13_multi_flag_demo/seller_claim.json";
import { assembleReport } from "@/lib/report";
import type { Extraction, SellerClaim } from "@/lib/contracts";
export const heroReport = assembleReport(extraction as unknown as Extraction, seller as unknown as SellerClaim);
```
(If TS complains about importing JSON outside `rootDir`, add `"dataset/**/*.json"` is covered by default `include`; otherwise widen `include` in `tsconfig.json`.)

- [ ] **Step 2: Components**

Create `components/Timeline.tsx`, `FlagCard.tsx`, `PartRiskCard.tsx`, `QuestionSheet.tsx` as client components. Timeline highlights events whose date is in any `odometer_regression`/`implausible_mileage_jump` flag's `entries` (red left-border + "odometer break" tag). FlagCard colors by severity (high `#e11d48`, medium `#f59e0b`, low `#64748b`) and renders `explanation` plus `context` if present (S12's dealer note). QuestionSheet renders `questions[].question` with a `window.print()` button.

```tsx
// components/FlagCard.tsx
"use client";
import { motion } from "framer-motion";
import type { Flag } from "@/lib/contracts";
const C = { high: "#e11d48", medium: "#f59e0b", low: "#64748b" } as const;
export function FlagCard({ flag, i }: { flag: Flag; i: number }) {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
      style={{ padding: 16, margin: "10px 0", borderRadius: 10, background: "#0f172a", borderLeft: `4px solid ${C[flag.severity]}` }}>
      <div style={{ fontSize: 12, color: C[flag.severity], textTransform: "uppercase", fontWeight: 700 }}>
        {flag.severity} · {flag.rule.replace(/_/g, " ")}
      </div>
      <div style={{ marginTop: 6 }}>{flag.explanation}</div>
      {flag.context ? <div style={{ marginTop: 6, fontSize: 13, opacity: 0.8 }}>Note on document: {String(flag.context)}</div> : null}
    </motion.div>
  );
}
```
(Build `Timeline.tsx`, `PartRiskCard.tsx`, `QuestionSheet.tsx` in the same visual language — see spec §10.)

- [ ] **Step 3: Report page (server passes hero to a client view)**

`app/report/page.tsx` (server) imports `heroReport` and renders a client `ReportView` that stages: timeline immediately, flags at 700ms, hidden costs at 1400ms, questions at 2100ms. Odometer-break dates = `flags.filter(f => f.rule.startsWith("odometer") || f.rule==="implausible_mileage_jump").flatMap(f => f.entries ?? [])`.

- [ ] **Step 4: Verify visually**

Run `npm run dev`, open `/report`. Expect S13's timeline with the 2022-01-27 entry flagged as an odometer break, then the 4 flags, then questions.

- [ ] **Step 5: Commit**

```bash
git add components app/report
git commit -m "feat: event-driven report UI on S13 hero (Layer 0 demo)"
```

---

## Task 6: Claude vision extraction route (schema-shaped)

**Files:** create `lib/claude.ts`, `app/api/extract/route.ts`; test `tests/extract-schema.test.ts`.

**Interfaces:** `POST /api/extract` with `{ base64, mediaType, docType, stem }` for a SINGLE image → a partial `Extraction` fragment for that doc. The client resizes each image and calls this once per image, then merges fragments. (Rationale: Vercel serverless caps request bodies at ~4.5 MB; one resized image per call stays well under it.)

- [ ] **Step 1: Claude client**

Create `lib/claude.ts`:
```ts
import Anthropic from "@anthropic-ai/sdk";
export const MODEL = "claude-opus-4-8";
export function getClient() {
  const key = (process.env.CLAUDE_API ?? "").trim();
  if (!key) throw new Error("CLAUDE_API missing");
  return new Anthropic({ apiKey: key });
}
```

- [ ] **Step 2: Extraction route**

Create `app/api/extract/route.ts`. Handles ONE image per call. The system prompt embeds `schemas/extraction.schema.json` and instructs: return ONLY the JSON fragment for this `docType` (an `rc` object, or a `service_book` object, or a single `insurance` object); never guess; mark unreadable fields in `low_confidence_fields` and set the value null; set `source` = the given `stem`. Parse, strip code fences, return the fragment. On any error return `{ error }` with status 200 (never breaks the flow). The client merges fragments into `{ rc, service_book, insurance: [] }` (service_book pages concatenated into one `entries[]`, insurance fragments pushed to the array) before calling `/api/verify`.

- [ ] **Step 3: Schema-shape test**

Create `tests/extract-schema.test.ts` asserting a hand-built object with `{rc, service_book, insurance}` keys type-checks as `Extraction` and feeds `assembleReport` without throwing.

- [ ] **Step 4: Run + manual live check**

Run `npx vitest run tests/extract-schema.test.ts` (PASS). Manual: POST `dataset/papertrail_test_data/scenarios/S02_odometer_regression/images/*` to `/api/extract`; compare against that scenario's `expected/extraction.json` (use `reference/eval_extraction.py` for scoring). Handwriting weakness is acceptable — hero path uses fixtures.

- [ ] **Step 5: Commit**

```bash
git add lib/claude.ts app/api/extract/route.ts tests/extract-schema.test.ts
git commit -m "feat: Claude vision extraction to schema shape"
```

---

## Task 7: Upload → extract → verify → report flow

**Files:** create `app/api/verify/route.ts`; rewrite `app/page.tsx`; update `app/report/page.tsx` to read a posted report.

**Interfaces:** `POST /api/verify` with `{ extraction, seller_claim }` → `Report` via `assembleReport` (scrapers merged in Task 9).

- [ ] **Step 1: Verify route**

Create `app/api/verify/route.ts`:
```ts
import { NextRequest, NextResponse } from "next/server";
import { assembleReport } from "@/lib/report";
export async function POST(req: NextRequest) {
  const { extraction, seller_claim } = await req.json();
  return NextResponse.json(assembleReport(extraction, seller_claim ?? { claimed_owners: null }));
}
```

- [ ] **Step 2: Upload page**

Rewrite `app/page.tsx`: file inputs for RC / service-book (multi) / insurance (multi, optional), a seller-claim textarea + claimed-owners number + optional asking price. On submit: for each file, **resize client-side** (draw to a canvas, longest edge ~1280px, export `image/jpeg` quality 0.8) then base64; POST each to `/api/extract` (one image per call) with its `docType` + `stem`; **merge fragments** into `{rc, service_book:{document_type:"service_book", entries:[...]}, insurance:[...]}`; POST `/api/verify` with `{extraction, seller_claim:{claimed_owners, raw_text}}`; store the `Report` in `sessionStorage["papertrail_report"]`; show the processing checklist; `router.push("/report")`.

Add a small `resizeToJpeg(file: File, maxEdge=1280, q=0.8): Promise<{base64, mediaType}>` helper (canvas-based) — keeps each upload well under the serverless body limit.

- [ ] **Step 3: Report reads session, falls back to hero**

Client `ReportView` reads `sessionStorage["papertrail_report"]`; if absent, uses the server hero report. Demo always renders.

- [ ] **Step 4: End-to-end check**

Run `npm run dev`. Upload an S02 scenario's images or open `/report` for the hero. Confirm a full report renders.

- [ ] **Step 5: Commit**

```bash
git add app/api/verify/route.ts app/page.tsx app/report
git commit -m "feat: upload -> extract -> verify -> report flow"
```

---

## Task 8: Cost-of-ownership engine (enrichment pillar)

**Files:** create `data/parts-catalog.json`, `lib/cost/costEngine.ts`; test `tests/cost.test.ts`; wire into `lib/report.ts`.

**Interfaces:** `assessParts(car: CarFacts, timeline: TLEvent[], catalog?): PartRisk[]`. A part named in a service entry's `notes`/`service_type` as replaced → `ok`. Overdue if age ≥ years_life or km ≥ km_life; due_soon at ≥80%. Wired into `assembleReport` so `report.part_risks` is populated.

- [ ] **Step 1: Seed catalog**

Create `data/parts-catalog.json` (extend later via claude.ai — see the "dataset additions" note below):
```json
[
  { "part": "Alternator", "category": "high", "km_life": 150000, "years_life": 9, "cost_min_inr": 8000, "cost_max_inr": 15000 },
  { "part": "Clutch assembly", "category": "high", "km_life": 90000, "years_life": 8, "cost_min_inr": 8000, "cost_max_inr": 18000 },
  { "part": "Turbocharger", "category": "high", "km_life": 130000, "years_life": 10, "cost_min_inr": 40000, "cost_max_inr": 80000 },
  { "part": "AC compressor", "category": "high", "km_life": 120000, "years_life": 9, "cost_min_inr": 15000, "cost_max_inr": 30000 },
  { "part": "Timing belt", "category": "high", "km_life": 100000, "years_life": 7, "cost_min_inr": 5000, "cost_max_inr": 15000 },
  { "part": "Suspension struts (set)", "category": "high", "km_life": 80000, "years_life": 8, "cost_min_inr": 8000, "cost_max_inr": 20000 },
  { "part": "Battery", "category": "low", "km_life": 55000, "years_life": 5, "cost_min_inr": 5000, "cost_max_inr": 8000 },
  { "part": "Tyres (set of 4)", "category": "low", "km_life": 45000, "years_life": 5, "cost_min_inr": 16000, "cost_max_inr": 40000 },
  { "part": "Brake pads and discs", "category": "low", "km_life": 45000, "years_life": 6, "cost_min_inr": 3000, "cost_max_inr": 10000 }
]
```

- [ ] **Step 2: Failing test**

Create `tests/cost.test.ts`: a 2016 / 62,000 km car → Alternator `overdue` with cost > 0 and high-priority overdue sorted first; a car whose service `notes` say "Battery replaced" → Battery not `overdue`.

- [ ] **Step 3: Implement `assessParts`** (age = currentYear − car.year; km = car.current_odometer_km; replaced = parts whose name appears in any service entry `note`/`service_type`, case-insensitive). Sort overdue→due_soon→ok, then high→low, then cost desc.

- [ ] **Step 4: Wire into report** — in `assembleReport`, set `part_risks: assessParts(carFactsFrom(ext), timeline)`.

- [ ] **Step 5: Run + commit**

Run `npx vitest run tests/cost.test.ts` (PASS); `npm test` (all green).
```bash
git add data/parts-catalog.json lib/cost/costEngine.ts tests/cost.test.ts lib/report.ts
git commit -m "feat: cost-of-ownership engine wired into report"
```

---

## Task 9: Anakin scrapers (moat) — spike then graceful adapters

**Files:** create `lib/scrapers/anakin.ts`, `vahan.ts`, `challan.ts`, `parts.ts`, `price.ts`; test `tests/scrapers.test.ts`; merge into `app/api/verify/route.ts`.

**Interfaces:**
- `anakinFetch(target): Promise<any | null>` — never throws.
- `fetchVahan(reg): Promise<{ owner_count_record?: number; chassis?: string } | null>` → adds `ownership_mismatch_vs_record` / `identity_mismatch_vs_record` HIGH flags when it disagrees with the paper. **These are new rule names, kept separate from the 13-scenario set.**
- `fetchChallans(reg): Promise<TLEvent[]>` (challan events; empty on failure).
- `fetchPartPrice(make, model, part): Promise<number | null>` (boodmo override for costEngine).
- `fetchPriceComps(make, model, year, maxPrice): Promise<PriceComp[]>`.

- [ ] **Step 1: SPIKE — confirm Anakin capability FIRST (~10 min)**

Read `ANAKIN_API` from `.env`. Make one real call. Determine: URL-scraper vs structured vehicle lookup. Test which targets respond: `vahan.parivahan.gov.in`, `echallan.parivahan.gov.in`, `boodmo.com`, `cars24.com`, `spinny.com`. Record findings as a comment at the top of `anakin.ts`. Blocked site → that scraper stays a graceful no-op. **Gates nothing — the app already passes all 13 scenarios and renders the hero without any scraper.**

- [ ] **Step 2: Graceful-failure test**

Create `tests/scrapers.test.ts`: stub `fetch` to reject; assert `fetchChallans("KA99...")` resolves to `[]` and `fetchVahan(...)` resolves to `null`.

- [ ] **Step 3: Base adapter** — `anakin.ts` reads `process.env.ANAKIN_API` (trimmed), POSTs the target, returns parsed JSON or `null`, wrapped in try/catch (see spec §Anakin). Fill the real endpoint/auth shape from the spike.

- [ ] **Step 4: Four scrapers + moat flags** — each calls `anakinFetch`, maps results, returns a safe default. In `vahan.ts`, after fetching, compare `owner_count_record` vs `car.owner_count_paper` and chassis vs paper → push `*_vs_record` flags.

- [ ] **Step 5: Merge into verify** — in `/api/verify`, `Promise.allSettled([fetchVahan, fetchChallans, fetchPriceComps])`; set `car.owner_count_record`, append challan events to the timeline before flag-rendering, add the moat flags, set `report.price_comps`; pass `fetchPartPrice` overrides into `assessParts`. One failure never blocks the report.

- [ ] **Step 6: Run + verify + commit**

Run `npx vitest run tests/scrapers.test.ts` (PASS); confirm report still renders with scrapers off; confirm the 13-scenario engine test is still green (enrichment didn't touch it).
```bash
git add lib/scrapers app/api/verify/route.ts tests/scrapers.test.ts
git commit -m "feat: Anakin scrapers + moat (ownership/identity vs public record), graceful"
```

---

## Task 10: Polish, deploy, capture submission assets

**Files:** report UI polish; `README.md`.

- [ ] **Step 1: Polish pass** — apply **emil-design-eng** (hierarchy, spacing, contrast, the odometer-break emphasis) and **animate** (timeline draw-in, card stagger, the regression reveal). Keep readable on a projector.
- [ ] **Step 2: Deploy** — `npx vercel --prod`; set `CLAUDE_API` + `ANAKIN_API` in the Vercel dashboard; confirm the hosted `/report` renders the S13 hero even before any upload (the link that must stay live one month).
- [ ] **Step 3: Record + capture** — screen-record the 2-minute flow (upload → timeline → odometer break → hidden costs → seller questions). Capture the submission stills: finished-build photo, UI detail shots, team photo, process shot, handwritten note.
- [ ] **Step 4: Commit + tag**
```bash
git add -A && git commit -m "feat: polish, deploy notes, submission assets" && git tag demo-ready
```

---

## Dataset additions to prepare in parallel (old claude.ai chat)

The 13 scenarios fully cover the document engine. To cover the enrichment pillars, generate these into the same repo shape (they plug into Tasks 8–9 tests):

1. **`data/parts-catalog.json` (expanded):** every practical high/low-priority part with `km_life`, `years_life`, `cost_min_inr`, `cost_max_inr`, per common Indian models (Swift, i20, City, Creta, Nexon, Baleno, WagonR). Boodmo is the price source.
2. **Cost scenarios** (`dataset/papertrail_test_data/cost/*.json`): `{car_facts, service_notes[]}` → `expected_part_risks[]`. ~5 cases incl. a documented-replacement suppression case and a diesel-turbo case.
3. **Challan mocks** (`.../mocks/challan_<reg>.json`): Anakin-shaped responses → expected challan events + overspeeding flag. Clean / one-challan / repeat-offender.
4. **Public-record mocks** (`.../mocks/vahan_<reg>.json`): owner_count + chassis → expected `ownership_mismatch_vs_record` / `identity_mismatch_vs_record`.
5. **Price mocks** (`.../mocks/price_<model>.json`): listings → expected sorted comps with the better-value pick.
6. **2–3 real handwritten RC/service books** (masked) as scenarios `S14+` in the existing folder shape — the only true test of live vision quality.

---

## Self-Review

**Spec + oracle coverage:** timeline (T1), all 7 rules matched to the oracle across 13 scenarios (T2), unreadable notices + questions (T3), report assembly + S13 hero (T4), event-driven storytelling UI + emil/animate (T5, T10), Claude extraction to the schema (T6), upload flow (T7), cost-of-ownership + boodmo (T8, T9), challans + price + moat ownership/identity-vs-record (T9), graceful degradation (T9), no-DB/session (throughout), deploy/hosted link (T10). The four enrichment pillars are additive and explicitly excluded from the 13-scenario rule-set assertion.

**Placeholder scan:** No TBD/TODO. Scraper endpoint auth is spike-driven (T9 Step 1) with a working graceful-null default. UI component bodies for Timeline/PartRiskCard/QuestionSheet are described with exact data bindings and one worked example (FlagCard); acceptable for a design-skill-driven task.

**Type + name consistency:** `Extraction`, `TLEvent`, `Flag`, `Report`, `CarFacts`, `PartRisk` used identically across tasks. Rule names exactly match `reference/engine.py` and the `expected/report.json` files. `buildTimeline`, `reconcile`, `unreadableNotices`, `questions`, `assembleReport`, `carFactsFrom`, `assessParts` signatures match their call sites. Confidence is 3-level throughout. Insurance-lapse threshold (`>1 day`), strict `>` gaps, and RC-serial-vs-seller-claim ownership all match the oracle — the earlier draft's divergences are corrected.
