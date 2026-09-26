# PaperTrail — Design Spec

**Date:** 2026-09-26 · **Context:** Claude Opus Build Day (Breakthrough track), ~2h build sprints
**Constitution (from mentor):** build ONE 100% reliable engine, not a pile of half-features. Everything is a prioritized, independently-cuttable stack, depth-first on odometer.

---

## 1. Product

PaperTrail lets a used-car buyer in India verify a seller's car before paying. The buyer photographs the RC, service booklet, and insurance. PaperTrail extracts the facts, builds one chronological timeline, reasons over it for inconsistencies, and cross-checks the paper against live public data the seller cannot fake. Output: a visual timeline, ranked sourced flags, a hidden-cost forecast, and a printable question sheet. One car, one session, no login, no database.

**The moat (answers "why not just use claude.ai"):** raw Claude reasons only over what you upload. PaperTrail reasons over your documents PLUS live-scraped ground truth (public vehicle record, challans, market prices, part costs) and cross-checks them. A seller can fake a document, not the public record.

**The pitch:** the ₹2,000 agency check (service history, price comparison, wear-and-tear, traffic violations, ownership history), done live for under ₹100 — plus the future-cost warning the agency does not give.

---

## 2. The five verification pillars = the engine

Built and cut in this priority order:

1. **Odometer Integrity** (flagship — deepest logic, built first and best)
2. **Ownership & Identity** (RC paper vs public record; chassis/reg cross-doc)
3. **Traffic Violations** (challans, overspeeding — scraped)
4. **Cost-of-Ownership** (wear-and-tear parts: lifetime vs the car's real facts; boodmo pricing)
5. **Price Comparison** (better-value alternatives at the seller's asking price — scraped)

Each pillar is one module reading/writing the shared contract, and **degrades gracefully**: if its data source fails, it shows "live verification unavailable" and nothing else breaks.

---

## 3. Architecture

Next.js (App Router) on Vercel. Frontend + backend (API routes) in one repo, one deploy, link stays live a month. Session state in memory only.

```
Browser (event-driven report UI)
   -> /api/extract   Claude vision: images -> structured JSON
   -> /api/verify    orchestrates reconciliation + pillar scrapers, streams results
        -> lib/rules/*        deterministic reconciliation (no AI)
        -> lib/cost/*         parts lifetime vs facts
        -> lib/scrapers/*     Anakin adapters (VAHAN, challan, price, parts)
   -> Claude reasoning pass    narrative + explanations over the timeline
```

Claude is load-bearing in two places: **vision extraction** and a **reasoning pass** that writes the human narrative over the deterministic flags. Numeric triggers stay deterministic (reliable, defensible); Claude handles the messy judgment and prose.

---

## 4. Shared data contract (the spine)

```ts
type Confidence = "high" | "low";

type TimelineEvent = {
  date: string;                 // ISO
  event: "registration" | "service" | "insurance" | "challan" | "transfer";
  odometer_km?: number;
  source: string;               // "RC" | "service_book_p2" | "vahan" | ...
  confidence: Confidence;
  meta?: Record<string, unknown>;
};

type Severity = "high" | "medium" | "low";

type Flag = {
  rule: string;
  severity: Severity;
  entries: string[];            // dates/ids that triggered it
  explanation: string;
  question?: string;            // seller question
  evidence_source: "documents" | "public_record" | "market" | "catalog";
};

type PartRisk = {
  part: string;
  priority: "high" | "low";
  est_cost_inr: number;         // from boodmo/catalog
  status: "overdue" | "due_soon" | "ok";
  reason: string;               // "age 9y > 8y life, no replacement in service record"
};

type CarFacts = {
  make?: string; model?: string; variant?: string; year?: number;
  fuel?: string; reg_number?: string; chassis?: string; engine?: string;
  owner_count_paper?: number; owner_count_record?: number;
  current_odometer_km?: number;
};

type Report = {
  car: CarFacts;
  timeline: TimelineEvent[];
  flags: Flag[];
  part_risks: PartRisk[];
  price_comps?: { source: string; title: string; price_inr: number; url: string }[];
  questions: string[];
};
```

Every module reads/writes this. Any pillar can be added, swapped, or cut without touching others.

---

## 5. Odometer Integrity engine (flagship)

Operates over every dated odometer datapoint (RC ~0 at registration, each service entry, insurance, any scraped reading), sorted by date. All numeric, deterministic, unit-tested.

- **O1 Regression** — any later date reads lower than an earlier date. Severity HIGH. Report the exact break pair + delta.
- **O2 Implausible jump** — km/day between consecutive points > ~150 km/day sustained. MEDIUM.
- **O3 Stagnation** — near-zero km over many months (e.g. < 5 km/day for > 6 months). MEDIUM — car sat unused (post-accident) or odometer disconnected.
- **O4 Cross-source contradiction** — two sources within ~30 days disagree materially. HIGH.
- **O5 Expected-vs-actual** — actual reading far below age × ~12,000 km/yr, combined with O1/O3, composes a rollback narrative.
- Low-confidence datapoints never trigger a hard flag — caveat only.
- Output: an **Odometer Integrity verdict** + the timeline chart with the break point visually highlighted (the "look what a skim missed" moment).

---

## 6. Ownership & Identity

- **Identity mismatch** — chassis/engine/reg disagree across documents, or between document and public record → highest severity (may not be the same vehicle). Surface first.
- **Ownership mismatch** — owner count on RC / seller's typed claim vs public record. HIGH.
- Public record fetched via Anakin (VAHAN or mirror) keyed on reg_number from RC extraction.

---

## 7. Traffic Violations

- Scrape `echallan.parivahan.gov.in` (+ state RTO) by reg_number.
- Produce challan events on the timeline; flag overspeeding / repeated violations.
- Graceful degradation if the site blocks the scraper.

---

## 8. Cost-of-Ownership engine (the alternator insight)

The differentiator the agency does not provide: future cost.

**Parts catalog** (seed JSON, top Indian models; boodmo for live pricing). Each part carries:
```
{ part, category: "high" | "low", km_life, years_life, cost_range_inr }
```

Seed catalog (life = whichever of km/years hits first):

| Part | Priority | km_life | years_life | typical ₹ |
|---|---|---|---|---|
| Alternator | high | 150,000 | 9 | 8k–15k |
| Clutch assembly (MT) | high | 90,000 | 8 | 8k–18k |
| Turbocharger | high | 130,000 | 10 | 40k–80k |
| Auto trans (AMT/DCT/CVT) service | high | 100,000 | 8 | 20k–100k |
| AC compressor | high | 120,000 | 9 | 15k–30k |
| Timing belt | high | 100,000 | 7 | 5k–15k |
| Catalytic converter | high | 120,000 | 10 | 15k–40k |
| Suspension (struts set) | high | 80,000 | 8 | 8k–20k |
| Radiator | low | 120,000 | 9 | 5k–12k |
| Battery | low | 55,000 | 5 | 5k–8k |
| Tyres (set of 4) | low | 45,000 | 5 | 16k–40k |
| Brake pads + discs | low | 45,000 | 6 | 3k–10k |
| Starter motor | low | 130,000 | 9 | 4k–8k |

**Rule:** for each part, given the car's real age and odometer:
- if age ≥ years_life OR km ≥ km_life, and no service record shows replacement → `overdue`.
- if within ~80% of either life → `due_soon`.
- else `ok`.
- Priority score = est_cost × urgency; render high-priority first.

**Dynamic pricing:** query boodmo (Anakin) for the specific make/model to override `cost_range` with a real number; Amazon.in fallback; seed range if both fail. The point mentor stressed: scrape the real part cost and compare against the car's real facts (age/km + whether service record already replaced it).

The catalog must be elaborated to cover every practical high- and low-priority part; the seed above is the starting set, expanded in `data/parts-catalog.json` (I seed, user extends via claude.ai prompts).

---

## 9. Price Comparison

- Scrape Cars24 / Spinny / CarDekho-used for the same make/model/year/fuel near the seller's asking price.
- Show 3–5 alternatives at or below asking, with better value highlighted. Read-only, best-effort.

---

## 10. Report UI (the "superhero energy" finish)

- **Event-driven:** report streams as each module completes — timeline first, then verdict cards land with motion.
- **Visual storytelling timeline** as the hero element; odometer break point called out.
- Cards per pillar: Odometer verdict, Ownership/Identity, Challans, Hidden Costs (parts), Price Comparison.
- Ends with the printable **seller-question sheet** (just the questions).
- Built with **emil-design-eng** (polish, invisible details) + **animate** (timeline draw-in, card reveals, the odometer-break reveal).

Question generator = flag → template lookup table, not an AI call (predictable, cheap).

---

## 11. Folder structure

App at repo root `D:\The One` (git root; `.env` holds `CLAUDE_API`).

```
app/
  page.tsx                 upload + seller-claim
  report/page.tsx          event-driven streaming report
  api/
    extract/route.ts       Claude vision -> JSON
    verify/route.ts        orchestrate reconcile + scrape, stream
    scrape/[pillar]/route.ts  Anakin adapters
lib/
  contracts.ts             shared types (section 4)
  claude.ts                Anthropic client (maps env CLAUDE_API)
  timeline.ts              deterministic builder
  rules/
    odometer.ts            O1–O5 flagship
    service.ts insurance.ts ownership.ts identity.ts
  cost/
    partsCatalog.ts        loads data/parts-catalog.json
    costEngine.ts          lifetime vs facts
  scrapers/
    anakin.ts              base adapter (graceful failure)
    vahan.ts challan.ts price.ts parts.ts
  questions.ts             flag -> question map
components/
  Timeline.tsx FlagCard.tsx PartRiskCard.tsx PriceComps.tsx QuestionSheet.tsx
data/
  hero-car/                fixtures + planted-discrepancy images
  parts-catalog.json
  model-issues.json
tests/
  rules.test.ts            unit tests on hero fixtures
```

---

## 12. Build order (each layer is a standalone demo — stop anywhere, still shippable)

0. **Skeleton + hero data** — Next.js app, screens wired to hardcoded hero-car `Report`. Safety net: demo runs even if every AI call fails.
1. **Odometer engine** — timeline builder + O1–O5 + unit tests on hero fixtures.
2. **Extraction** — `/api/extract` Claude vision -> shared JSON, feeds the engine.
3. **Ownership & Identity** — reconciliation + VAHAN scrape.
4. **Challans** — echallan scrape.
5. **Cost-of-Ownership** — parts catalog + costEngine + boodmo pricing.
6. **Price Comparison** — Cars24/Spinny scrape.
7. **Report polish** — emil-design-eng + animate, printable question sheet, demo video.

---

## 13. Explicitly NOT building (ponytail)

No login, accounts, database, saved history, multi-car, single risk score, forgery/authenticity detection, microservices. Scrapers are isolated adapters so the untested Anakin API never blocks the core.

---

## 14. Known integration notes

- **Env:** key is `CLAUDE_API` in `.env` (stray trailing space in key name); `lib/claude.ts` reads `process.env.CLAUDE_API` and passes it explicitly to the Anthropic SDK (which normally wants `ANTHROPIC_API_KEY`).
- **Anakin API:** capabilities untested. First task is a spike to confirm what it can fetch and which of the target sites (VAHAN, echallan, boodmo, Cars24, Spinny) are scrapable; scrapers degrade gracefully regardless.
- **Dataset:** hero-car images with planted odometer regression + service gap + ownership mismatch guarantee the live demo fires. Real gathered dataset (35 RC cards, insurance PDFs in `dataset/`) shown as "also works on these."
```
