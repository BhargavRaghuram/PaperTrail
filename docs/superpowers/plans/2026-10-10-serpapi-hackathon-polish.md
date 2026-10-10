# SerpApi Hackathon Polish — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the print/export anti-pattern, add a second genuine SerpApi integration (live part pricing), and replace the generic "working…" spinner with a truthful, narrated activity log so judges can see — not be told — what OpenAI vision and SerpApi are doing in real time.

**Architecture:** No new subsystems. Three independent slices on top of the existing Next.js App Router codebase: (1) a React-state-owned print scope on the report page, (2) a new pure `partPrice` module plugged into the existing (already-tested, previously-unused) `assessParts(..., priceOverride)` mechanism via `enrichReport`, (3) a new `ActivityLog` presentational component driven by real await boundaries already present in `app/page.tsx`'s `run()` — no fake timers, no simulated progress.

**Tech Stack:** Next.js 16 / React 19 / TypeScript, framer-motion (already a dependency — no new deps), Vitest. No 3D library: the one "3D" moment (a tilting document card during document extraction) is done with plain CSS `perspective`/`rotateX`/`rotateY`, not Three.js/WebGL — see Global Constraints.

**Spec:** No separate spec file — this is a **bounded**-path change per `superpowers:brainstorming` (existing repo, existing flows, no new subsystem). The agreed design is the in-chat discussion in this conversation (the "four pieces" message proposing the print fix, the activity log, live part pricing, and track selection, refined by the user's follow-up to use `/ponytail` discipline, consult `/animate` + `/emil-design-eng` for motion, and use a 3D element "when required"). This document is the executable record of that design.

## Global Constraints

- No new npm dependencies. In particular: no Three.js/WebGL/any 3D library — the 3D requirement is met with CSS 3D transforms only (`perspective`, `transform-style: preserve-3d`, `rotateX`/`rotateY`), per `/ponytail` rung 2 ("does it already exist / can the platform do it") and the hard deadline tonight.
- This project already has an established visual design system: CSS custom properties in `app/globals.css` (`--iris-deep`, `--ok`/`--ok-tint`, `--warn`/`--warn-tint`, `--danger`/`--danger-tint`, `--hair`, `.btn`/`.btn-primary`/`.btn-ghost`, `.card`, `.badge`, `.mono`, `.eyebrow`) and an existing `ping-fade` keyframe used for pulse effects (`components/Timeline.tsx`, `components/OdometerChart.tsx`). New UI must extend these tokens/classes, not invent parallel ones. For this reason `/design`, `/design-sync`, and `/brand` are **not** invoked in this plan — the brand/design system already exists in this repo; re-running those skills would rebuild something that's already here (`/ponytail` rung 2).
- `/animate` and `/emil-design-eng` **are** consulted (one Skill-tool call each, see Task 4) specifically for the new `ActivityLog` motion, since that is genuinely new motion design, not a reuse of an existing pattern.
- `window.print()` is unavoidable (it's the only API that opens the browser print dialog) but must never be called from inline JSX alongside raw `document.*` mutation. All browser-global access for printing lives behind React state in `app/report/page.tsx`; `components/QuestionSheet.tsx` must not import or touch `window`/`document` at all after Task 1.
- Live SerpApi part-price lookups are capped at 4 per report (`.slice(0, 4)` on the non-"ok" parts) to bound latency and credit usage — matches the existing `comps.length >= 4` cap pattern already in `lib/scrapers/price.ts`.
- Copy must say "OpenAI" and "SerpApi" accurately; never reintroduce "Claude"/"Anakin" wording in user-facing text (continuity with the fix already shipped in `app/report/page.tsx`'s footer).
- Every task must leave `npx tsc --noEmit` clean and all existing Vitest tests passing (50 tests as of this plan). Run both after every task, not just at the end.
- Track for the SerpApi India Hackathon submission: **Commerce & Market Intelligence** (the product's core claim is "is this car worth what they're asking, cross-checked against real market data") — encoded in Task 6's README update; flag to the user if they'd rather pick a different track before submitting.
- Deadline is tonight. Each task must leave the app in a working, demoable state — no task should be started if it can't be finished and verified before moving to the next one.

## Review Focus

1. **A document-extraction or SerpApi call fails mid-sequence** (bad key, network error, non-JSON response) — the activity log must show an error line for that step and the flow must still continue to the next document / fall back gracefully, not hang forever or crash the page. `extractOne` and `enrichReport` already degrade gracefully server-side (return `null`/skip); the new client-side log wrapper must surface that, not swallow it silently. Covered in Task 5.
2. **Full-report print/export when `price_comps` or `part_risks` is empty** — existing `{r.price_comps.length > 0 && (...)}` / `{activeCosts.length > 0 && (...)}` guards must still correctly hide those sections after the print-scope refactor (no regression from moving the attribute from `<body>` to `<main>`). Covered in Task 1.
3. **Live part-price parsing returns noise** (a car price, a km figure, a stray large number) instead of a real spare-part price — must fall back to the catalog estimate rather than display a nonsensical ₹ figure. Covered in Task 2's unit tests (plausible-price band filter) and Task 3 (only overrides when a value actually comes back).
4. **Double-printing** — user clicks "Export full report" then immediately "Print just these questions" (or double-clicks the same button) — must not leave stale `printScope` state or fire `window.print()` twice concurrently. Covered in Task 1 (the `afterprint` reset + effect keyed on state, not on click count).
5. **Multi-page service book / insurance uploads** — the activity log must show one real line per page (each a real `/api/extract` call), not one aggregate line that hides per-page failures (e.g. page 2 unreadable while page 1 succeeds). Covered in Task 5 by keying log lines per file index, matching the existing per-page loop already in `run()`.

---

## Task 1: Fix the print/export anti-pattern

**Files:**
- Modify: `app/report/page.tsx`
- Modify: `components/QuestionSheet.tsx`
- Modify: `app/globals.css:184-195` (print media block — retarget selector from `body[data-print-scope]` to `main[data-print-scope]`)

**Interfaces:**
- Consumes: nothing new.
- Produces: `QuestionSheet` now requires an `onPrint: () => void` prop (breaking change to its existing callers — there is exactly one caller, `app/report/page.tsx`, updated in this same task).

- [ ] **Step 1: Update the print CSS to target `<main>` instead of `<body>`**

In `app/globals.css`, replace the existing print block:

```css
/* ── Print: defaults to the full report; body[data-print-scope="sheet"] narrows to just the question sheet ── */
@media print {
  :root { --paper: #ffffff; --bone: #ffffff; }
  body { background: #fff; }
  .no-print { display: none !important; }

  /* Framer Motion leaves inline opacity/transform on scroll-reveal elements that never
     entered the viewport; force everything visible so the printed page isn't blank below the fold. */
  * { animation: none !important; transition: none !important; opacity: 1 !important; transform: none !important; }

  body[data-print-scope="sheet"] [data-print="hide"] { display: none !important; }
  body[data-print-scope="sheet"] [data-print="sheet"] { display: block !important; }
}
```

with:

```css
/* ── Print: defaults to the full report; main[data-print-scope="sheet"] narrows to just the question sheet ── */
@media print {
  :root { --paper: #ffffff; --bone: #ffffff; }
  body { background: #fff; }
  .no-print { display: none !important; }

  /* Framer Motion leaves inline opacity/transform on scroll-reveal elements that never
     entered the viewport; force everything visible so the printed page isn't blank below the fold. */
  * { animation: none !important; transition: none !important; opacity: 1 !important; transform: none !important; }

  main[data-print-scope="sheet"] [data-print="hide"] { display: none !important; }
  main[data-print-scope="sheet"] [data-print="sheet"] { display: block !important; }
}
```

- [ ] **Step 2: Move print state into React on the report page**

In `app/report/page.tsx`, replace the two existing `useEffect` calls (the `sessionStorage` load effect stays; the `afterprint` effect changes) and the header button's `onClick`:

Replace:
```tsx
  useEffect(() => {
    const reset = () => delete document.body.dataset.printScope;
    window.addEventListener("afterprint", reset);
    return () => window.removeEventListener("afterprint", reset);
  }, []);
```
with:
```tsx
  const [printScope, setPrintScope] = useState<"full" | "sheet" | null>(null);

  useEffect(() => {
    if (!printScope) return;
    const id = requestAnimationFrame(() => window.print());
    return () => cancelAnimationFrame(id);
  }, [printScope]);

  useEffect(() => {
    const reset = () => setPrintScope(null);
    window.addEventListener("afterprint", reset);
    return () => window.removeEventListener("afterprint", reset);
  }, []);
```

Add `useState` to the existing `import { useEffect, useState } from "react";` line (already imports `useState` for the report state — just confirm it's there, it is).

Replace the header button:
```tsx
          <button
            type="button"
            className="no-print btn btn-ghost"
            onClick={() => {
              delete document.body.dataset.printScope;
              window.print();
            }}
          >
            <Printer width={16} height={16} /> Export full report
          </button>
```
with:
```tsx
          <button type="button" className="no-print btn btn-ghost" onClick={() => setPrintScope("full")}>
            <Printer width={16} height={16} /> Export full report
          </button>
```

Add `data-print-scope={printScope ?? undefined}` to the `<main style={wrap}>` tag:
```tsx
    <main style={wrap} data-print-scope={printScope ?? undefined}>
```

Update the `QuestionSheet` call to pass the new prop and drop any internal print handling:
```tsx
          <QuestionSheet questions={r.questions} carLabel={carLabel} onPrint={() => setPrintScope("sheet")} />
```

- [ ] **Step 3: Make `QuestionSheet` purely presentational — no `window`/`document` access**

In `components/QuestionSheet.tsx`, replace the whole file:

```tsx
"use client";
import { Printer } from "./icons";

export function QuestionSheet({
  questions,
  carLabel,
  onPrint,
}: {
  questions: { rule: string; question: string }[];
  carLabel?: string;
  onPrint: () => void;
}) {
  return (
    <div>
      <button type="button" className="no-print btn btn-primary" onClick={onPrint} style={{ marginBottom: 18 }}>
        <Printer width={16} height={16} /> Print just these questions
      </button>

      <div data-print="sheet" className="card" style={{ padding: "24px 24px 12px" }}>
        <p className="no-print" style={{ margin: "0 0 16px", color: "var(--ink-2)", fontSize: 14, maxWidth: "56ch" }}>
          Ask these before you pay. Each one is tied to something the documents could not explain.
        </p>
        {carLabel && (
          <p className="eyebrow" style={{ margin: "0 0 14px" }}>{carLabel}</p>
        )}
        <ol style={{ margin: 0, paddingLeft: 0, listStyle: "none" }}>
          {questions.map((q, i) => (
            <li key={i} style={{
              display: "flex", gap: 14, alignItems: "baseline",
              padding: "13px 0", borderTop: i === 0 ? "none" : "1px solid var(--hair)",
            }}>
              <span aria-hidden className="tnum mono" style={{ flex: "none", fontSize: 14, fontWeight: 600, color: "var(--iris-deep)", width: 22 }}>
                {String(i + 1).padStart(2, "0")}
              </span>
              <span style={{ lineHeight: 1.5, fontSize: 15 }}>{q.question}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Verify — no `window`/`document` left in `QuestionSheet.tsx`, typecheck clean**

Run: `grep -n "window\.\|document\." "components/QuestionSheet.tsx"`
Expected: no output (empty).

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: `TypeScript: No errors found`

- [ ] **Step 5: Verify in the browser — both print paths produce the right scope**

Start the dev server if not already running (`rtk proxy "node_modules/.bin/next.cmd dev"` in this repo's shell, per earlier session notes — plain `next dev` is intercepted by the `rtk` hook and exits early).

With the server up, open `/report` (it falls back to the bundled `heroReport` if `sessionStorage` is empty, which is enough to verify this visually):
1. Click **Export full report** → confirm the browser print preview shows the header, odometer chart, timeline, issues, costs, price comps, questions, and footer (everything, not just the questions).
2. Close the preview, click **Print just these questions** → confirm the preview now shows *only* the question sheet, matching the pre-existing "print-clean on white paper" behavior.
3. Confirm no section is blank (the `opacity: 1 !important` print-media override from Task 1 Step 1 should force any below-the-fold Framer Motion elements visible).
4. Click **Export full report**, and before the print dialog closes, click it again (or click **Print just these questions** immediately after) — confirm the app doesn't throw, doesn't open two print dialogs, and `printScope` ends up correct for whichever you clicked last. This is the double-print case from Review Focus #4.
5. Confirm the empty-state guards are untouched — Review Focus #2 (empty `price_comps`/`part_risks` shouldn't render a blank section header in the full export): `grep -n 'price_comps.length > 0\|activeCosts.length > 0' app/report/page.tsx` must still show both conditionals present and unchanged — this task only touched the `data-print-scope` attribute and the two button handlers, not this JSX, so the guards should be exactly as before.

- [ ] **Step 6: Commit**

```bash
git add app/report/page.tsx components/QuestionSheet.tsx app/globals.css
git commit -m "fix: move print/export scope into React state, remove DOM access from QuestionSheet"
```

---

## Task 2: Live part-price lookup module (pure function + test)

**Files:**
- Create: `lib/scrapers/partPrice.ts`
- Test: `tests/partPrice.test.ts`

**Interfaces:**
- Consumes: `searchProvider` from `@/lib/providers/search` (existing, from the earlier SerpApi/Anakin provider swap — `searchProvider.search(prompt: string): Promise<SearchResult[] | null>`).
- Produces: `parseRupeePrice(text: string): number | null` (pure, exported for testing) and `livePartPrice(make: string | undefined, model: string | undefined, part: string): Promise<number | null>` (consumed by Task 3).

- [ ] **Step 1: Write the failing tests**

Create `tests/partPrice.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { parseRupeePrice } from "@/lib/scrapers/partPrice";

describe("parseRupeePrice", () => {
  it("parses a plain rupee figure from a snippet", () => {
    expect(parseRupeePrice("Timing belt replacement cost: ₹8,500 at authorised service center")).toBe(8500);
  });

  it("expands a k-suffixed figure (no space before the k)", () => {
    expect(parseRupeePrice("Battery available for ₹7k at most garages")).toBe(7000);
  });

  it("expands a lakh figure", () => {
    expect(parseRupeePrice("Turbocharger replacement can run up to ₹1.2 lakh")).toBe(120000);
  });

  it("does not mistake a unit like 'km' for the k-suffix", () => {
    expect(parseRupeePrice("Car has done ₹500 km this month on a full tank")).toBe(500);
  });

  it("takes the median across multiple matches to shrug off outliers", () => {
    expect(parseRupeePrice("Garage quotes ₹6,000 to ₹9,000, some list the whole car at ₹42,00,000")).toBe(9000);
  });

  it("returns null when nothing in a plausible part-price band is found", () => {
    expect(parseRupeePrice("No price mentioned here, just a car description")).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/partPrice.test.ts`
Expected: FAIL — `Cannot find module '@/lib/scrapers/partPrice'` (module doesn't exist yet).

- [ ] **Step 3: Implement**

Create `lib/scrapers/partPrice.ts`:

```ts
import { searchProvider } from "@/lib/providers/search";

// Plausible spare-part price band in INR — filters out car prices, km figures, phone numbers, etc.
const MIN_PLAUSIBLE = 300;
const MAX_PLAUSIBLE = 150000;

/**
 * Pulls a representative rupee figure out of free text. "k" must be glued to the
 * number (₹7k) to count as a suffix — a space before it (as in "₹500 km") does not.
 * "lakh" may have a space before it, matching how Indian-English sources write it.
 */
export function parseRupeePrice(text: string): number | null {
  const matches = [...text.matchAll(/₹\s*([\d,]+(?:\.\d+)?)(k)?(?:\s*(lakh))?/gi)];
  const vals = matches
    .map((m) => {
      const n = parseFloat(m[1].replace(/,/g, ""));
      if (m[3]) return n * 100000;
      if (m[2]) return n * 1000;
      return n;
    })
    .filter((n) => n >= MIN_PLAUSIBLE && n <= MAX_PLAUSIBLE)
    .sort((a, b) => a - b);
  if (!vals.length) return null;
  return Math.round(vals[Math.floor(vals.length / 2)]);
}

export async function livePartPrice(
  make: string | undefined,
  model: string | undefined,
  part: string,
): Promise<number | null> {
  if (!make && !model) return null;
  const q = [make, model, part, "price India"].filter(Boolean).join(" ");
  const results = await searchProvider.search(q);
  if (!results || !results.length) return null;
  return parseRupeePrice(results.map((r) => `${r.title} ${r.snippet}`).join(" "));
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/partPrice.test.ts`
Expected: PASS — 6 tests.

- [ ] **Step 5: Run the full suite and typecheck**

Run: `npx vitest run`
Expected: all tests pass (56 total: the existing 50 plus these 6).

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: `TypeScript: No errors found`

- [ ] **Step 6: Commit**

```bash
git add lib/scrapers/partPrice.ts tests/partPrice.test.ts
git commit -m "feat: add live part-price parsing via SerpApi (pure function, tested)"
```

---

## Task 3: Wire live part pricing into the report, add a "Live · SerpApi" badge

**Files:**
- Modify: `lib/contracts.ts` (add `source` to `PartRisk`)
- Modify: `lib/cost/costEngine.ts` (stamp `source: "catalog"` by default)
- Modify: `lib/scrapers/enrich.ts` (fetch live prices for non-"ok" parts, re-run `assessParts` with overrides)
- Modify: `components/PartRiskCard.tsx` (show the badge)
- Modify: `app/globals.css` (add `--iris-tint` token, following the existing `--danger-tint`/`--warn-tint`/`--ok-tint` pattern)

**Interfaces:**
- Consumes: `livePartPrice` from `@/lib/scrapers/partPrice` (Task 2); `assessParts(car, events, catalog?, priceOverride?)` from `@/lib/cost/costEngine` (existing, already supports a `priceOverride: Record<string, number>` fourth argument — confirmed by the existing passing test `"honours a live price override"` in `tests/cost.test.ts`).
- Produces: `PartRisk.source: "live" | "catalog"` (required field), consumed by `PartRiskCard` and nothing else.

- [ ] **Step 1: Add the `source` field to the `PartRisk` type**

In `lib/contracts.ts`, change:
```ts
export interface PartRisk {
  part: string; priority: "high" | "low"; est_cost_inr: number;
  status: "overdue" | "due_soon" | "ok"; reason: string;
}
```
to:
```ts
export interface PartRisk {
  part: string; priority: "high" | "low"; est_cost_inr: number;
  status: "overdue" | "due_soon" | "ok"; reason: string;
  source: "live" | "catalog";
}
```

- [ ] **Step 2: Stamp a default `source` in `assessParts`**

In `lib/cost/costEngine.ts`, in the `risks.map<PartRisk>((c) => {...})` block, both `return` statements need the new field. Change:
```ts
    if (replaced) {
      return { part: c.part, priority: c.category, est_cost_inr: cost, status: "ok", reason: "Replacement noted in the service record." };
    }
```
to:
```ts
    if (replaced) {
      return { part: c.part, priority: c.category, est_cost_inr: cost, status: "ok", reason: "Replacement noted in the service record.", source: "catalog" };
    }
```
and change:
```ts
    return { part: c.part, priority: c.category, est_cost_inr: cost, status, reason };
```
to:
```ts
    return { part: c.part, priority: c.category, est_cost_inr: cost, status, reason, source: "catalog" };
```

- [ ] **Step 3: Run existing cost tests to confirm no regression**

Run: `npx vitest run tests/cost.test.ts`
Expected: PASS — all 4 existing tests (they assert specific fields via `.find()`, not deep equality, so the new field is additive and safe).

- [ ] **Step 4: Fetch live prices in `enrichReport` and re-price with the existing override mechanism**

In `lib/scrapers/enrich.ts`, add the import:
```ts
import { assessParts } from "@/lib/cost/costEngine";
import { livePartPrice } from "./partPrice";
```

After the existing market-price block (`report.market = { low: market.low, high: market.high, count: market.count, source: market.source };`) and before `report.questions = questions(report.flags);`, add:

```ts
  const stale = report.part_risks.filter((p) => p.status !== "ok").slice(0, 4);
  if (stale.length && (car.make || car.model)) {
    const prices = await Promise.all(stale.map((p) => livePartPrice(car.make, car.model, p.part)));
    const overrides: Record<string, number> = {};
    stale.forEach((p, i) => {
      const price = prices[i];
      if (price) overrides[p.part] = price;
    });
    if (Object.keys(overrides).length) {
      report.part_risks = assessParts(car, report.timeline, undefined, overrides).map((p) => ({
        ...p,
        source: overrides[p.part] != null ? ("live" as const) : p.source,
      }));
    }
  }
```

- [ ] **Step 5: Add the "Live · SerpApi" tint token and badge**

In `app/globals.css`, near the existing tint tokens (`--danger-tint`, `--warn-tint`, `--ok-tint`), add:
```css
  --iris-tint: #f1e9f9;
```

In `components/PartRiskCard.tsx`, in the header row (`<div style={{ display: "flex", alignItems: "center", gap: 9 }}>...</div>` containing the part name and status badge), add a second badge after the existing status badge:
```tsx
          <span style={{ fontWeight: 600, fontSize: 15 }}>{risk.part}</span>
          <span className="badge" style={{ color: s.color, background: s.tint }}>{s.label}</span>
          {risk.source === "live" && (
            <span className="badge" style={{ color: "var(--iris-deep)", background: "var(--iris-tint)" }}>Live · SerpApi</span>
          )}
```

- [ ] **Step 6: Verify end-to-end against the live SerpApi key**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: `TypeScript: No errors found`

Run: `npx vitest run`
Expected: all tests pass (56).

With the dev server running, replay the same `/api/verify` call used earlier in this session (hero car, Maruti Dzire / or substitute the make/model actually returned by your test RC) and inspect `part_risks` in the response:
```bash
curl -s -X POST http://localhost:3000/api/verify -H "Content-Type: application/json" -d '{"extraction":{"rc":{"document_type":"rc","source":"rc.jpg","registration_number":"KA99JD6645","registration_date":"2017-01-10","chassis_number":"MA3EYD81S00C66452","owner_serial":2,"maker":"Maruti","model":"Dzire","fuel":"Diesel","confidence":"high"},"service_book":null,"insurance":[]},"seller_claim":{"claimed_owners":2},"asking_price_inr":500000}' | node -e "const d=JSON.parse(require('fs').readFileSync(0));console.log(d.part_risks.map(p=>({part:p.part,cost:p.est_cost_inr,source:p.source})))"
```
Expected: at least one entry with `source: 'live'` and a plausible, non-round `est_cost_inr` (confirms a real SerpApi price was parsed, not just the catalog midpoint). If every entry shows `source: 'catalog'`, check the server log for `[serpapi]` lines on this request — it's a legitimate (if less impressive) outcome when SerpApi genuinely returns no parseable price for that part/model.

- [ ] **Step 7: Commit**

```bash
git add lib/contracts.ts lib/cost/costEngine.ts lib/scrapers/enrich.ts components/PartRiskCard.tsx app/globals.css
git commit -m "feat: live part pricing via SerpApi, second real integration beyond market comps"
```

---

## Task 4: Build the `ActivityLog` component

**Files:**
- Create: `components/ActivityLog.tsx`

**Interfaces:**
- Consumes: framer-motion (`motion`, `AnimatePresence`, `useReducedMotion` — all already used elsewhere in this codebase, e.g. `components/PartRiskCard.tsx`).
- Produces: `export type LogStatus = "pending" | "active" | "done" | "error"`, `export interface LogLine { id: string; text: string; status: LogStatus; kind?: "scan" | "search" }`, `export function ActivityLog({ lines }: { lines: LogLine[] })`. Consumed by Task 5 (`app/page.tsx`).

- [ ] **Step 1: Consult motion/polish guidance before writing the animation**

Invoke the Skill tool with `skill: "animate"` and ask specifically about: a list of short-lived status lines entering/updating in place (not a one-shot reveal), and a continuous "in-progress" pulse on the active line. Invoke `skill: "emil-design-eng"` for spacing/weight/restraint guidance on a console-style status feed sitting inside an existing card-based design system. Apply whatever concrete guidance those return (duration/easing values, restraint on simultaneous motion) to Step 2 below — this step has no separate code output, it just informs Step 2.

- [ ] **Step 2: Implement the component**

Create `components/ActivityLog.tsx`:

```tsx
"use client";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

export type LogStatus = "pending" | "active" | "done" | "error";
export interface LogLine {
  id: string;
  text: string;
  status: LogStatus;
  /** "scan" shows the tilting-document motif (document reads); "search" is a plain pulse (web lookups). */
  kind?: "scan" | "search";
}

const DOT: Record<LogStatus, string> = {
  pending: "var(--hair-2)",
  active: "var(--iris-deep)",
  done: "var(--ok)",
  error: "var(--danger)",
};

function ScanIcon({ active, reduce }: { active: boolean; reduce: boolean | null }) {
  return (
    <div style={{ perspective: 220, width: 22, height: 17, flex: "none" }}>
      <motion.div
        style={{
          width: "100%", height: "100%", borderRadius: 3,
          background: "var(--paper)", border: "1px solid var(--hair-2)",
          position: "relative", overflow: "hidden", transformStyle: "preserve-3d",
        }}
        animate={active && !reduce ? { rotateX: [6, -6, 6], rotateY: [-8, 8, -8] } : { rotateX: 0, rotateY: 0 }}
        transition={{ duration: 2.4, repeat: active && !reduce ? Infinity : 0, ease: "easeInOut" }}
      >
        <div aria-hidden style={{ position: "absolute", inset: "2px 3px", display: "flex", flexDirection: "column", gap: 2 }}>
          {[1, 1, 0.6].map((w, i) => (
            <span key={i} style={{ height: 2, width: `${w * 100}%`, background: "var(--hair-2)", borderRadius: 1 }} />
          ))}
        </div>
        {active && !reduce && (
          <motion.div
            aria-hidden
            animate={{ top: ["-30%", "120%"] }}
            transition={{ duration: 1.1, repeat: Infinity, ease: "linear" }}
            style={{ position: "absolute", left: 0, right: 0, height: "35%", background: "linear-gradient(180deg, transparent, var(--iris-tint), transparent)" }}
          />
        )}
      </motion.div>
    </div>
  );
}

export function ActivityLog({ lines }: { lines: LogLine[] }) {
  const reduce = useReducedMotion();
  if (!lines.length) return null;

  return (
    <div className="card" style={{ padding: "16px 18px", marginTop: 18 }}>
      <AnimatePresence initial={false}>
        {lines.map((l) => (
          <motion.div
            key={l.id}
            layout
            initial={reduce ? false : { opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0" }}
          >
            {l.kind === "scan" ? (
              <ScanIcon active={l.status === "active"} reduce={reduce} />
            ) : (
              <span aria-hidden style={{ position: "relative", width: 8, height: 8, flex: "none" }}>
                <span style={{ display: "block", width: 8, height: 8, borderRadius: "50%", background: DOT[l.status] }} />
                {l.status === "active" && !reduce && (
                  <span
                    aria-hidden
                    style={{
                      position: "absolute", inset: 0, borderRadius: "50%", background: DOT.active,
                      animation: "ping-fade 1.3s var(--ease-out) infinite",
                    }}
                  />
                )}
              </span>
            )}
            <span className="mono" style={{ fontSize: 13.5, color: l.status === "pending" ? "var(--ink-3)" : "var(--ink)" }}>
              {l.text}
            </span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: `TypeScript: No errors found` (the component isn't wired into any page yet, so this just confirms it's self-consistent).

- [ ] **Step 4: Commit**

```bash
git add components/ActivityLog.tsx
git commit -m "feat: add ActivityLog component (narrated progress, 3D scan motif, no new deps)"
```

---

## Task 5: Wire `ActivityLog` into the upload flow

**Files:**
- Modify: `app/page.tsx`

**Interfaces:**
- Consumes: `ActivityLog`, `LogLine`, `LogStatus` from `@/components/ActivityLog` (Task 4).
- Produces: nothing consumed elsewhere — this is the leaf of the chain.

- [ ] **Step 1: Consult UI guidance for the badge/status treatment**

Invoke the Skill tool with `skill: "ui-ux-pro-max"` and ask specifically about status-feed color/contrast conventions (pending/active/done/error) to sanity-check the `DOT` mapping already chosen in Task 4 against accessible-contrast norms, and `skill: "ui-styling"` for how to present the submit button once its only job is "disabled or not" (detail now lives in the log, not the button). Apply any concrete adjustment directly in Step 3 below.

- [ ] **Step 2: Add log-line state and a logging wrapper around `extractOne`**

In `app/page.tsx`, add the import:
```tsx
import { ActivityLog, type LogLine } from "@/components/ActivityLog";
```

Replace the `const [busy, setBusy] = useState<string | null>(null);` line with:
```tsx
  const [running, setRunning] = useState(false);
  const [log, setLog] = useState<LogLine[]>([]);
```

Below the existing top-level `extractOne` function (leave it unchanged), add two new top-level helpers:
```tsx
function describeFragment(docType: string, f: Record<string, any> | null): string {
  if (!f) return "Could not read this page — skipped";
  if (docType === "rc") {
    const bits = [f.maker, f.model].filter(Boolean).join(" ");
    return `✓ ${bits || "RC read"}${f.owner_serial ? ` · owner ${f.owner_serial}` : ""}`;
  }
  if (docType === "service_book") {
    const n = f.entries?.length ?? 0;
    return `✓ ${n} service entr${n === 1 ? "y" : "ies"} found`;
  }
  if (docType === "insurance") {
    return `✓ ${f.insurer ?? "Policy"}${f.policy_number ? ` · ${f.policy_number}` : ""}`;
  }
  return "✓ Read";
}
```

Inside the `Home` component (after `const [error, setError] = useState<string | null>(null);`), add:
```tsx
  function pushLine(id: string, text: string, status: LogLine["status"], kind?: LogLine["kind"]) {
    setLog((prev) => {
      const i = prev.findIndex((l) => l.id === id);
      const line: LogLine = { id, text, status, kind };
      if (i === -1) return [...prev, line];
      const copy = prev.slice();
      copy[i] = line;
      return copy;
    });
  }

  async function extractWithLog(file: File, docType: string, stem: string, id: string, label: string) {
    pushLine(id, `Reading ${label} with OpenAI vision…`, "active", "scan");
    const f = await extractOne(file, docType, stem);
    pushLine(id, describeFragment(docType, f), f ? "done" : "error", "scan");
    return f;
  }
```

- [ ] **Step 3: Rewrite `run()` to drive the log from the real await boundaries**

Replace the entire `async function run() { ... }` body with:
```tsx
  async function run() {
    setError(null);
    setLog([]);
    setRunning(true);
    try {
      const extraction: Extraction = { rc: null, service_book: null, insurance: [] };

      if (rc) {
        const f = await extractWithLog(rc, "rc", "rc", "rc", "the RC");
        if (f) extraction.rc = f;
      }
      if (service && service.length) {
        const entries: ServiceEntry[] = [];
        let vehicle: ServiceBook["vehicle"] | undefined;
        for (let i = 0; i < service.length; i++) {
          const f = await extractWithLog(service[i], "service_book", `service_book_p${i + 1}`, `svc-${i}`, `service book page ${i + 1}`);
          if (f?.entries) entries.push(...f.entries);
          if (f?.vehicle && !vehicle) vehicle = f.vehicle;
        }
        extraction.service_book = { document_type: "service_book", vehicle, entries };
      }
      if (insurance && insurance.length) {
        for (let i = 0; i < insurance.length; i++) {
          const f = await extractWithLog(insurance[i], "insurance", `insurance_${i + 1}`, `ins-${i}`, `insurance page ${i + 1}`);
          if (f) extraction.insurance.push(f);
        }
      }

      pushLine("verify", "Cross-checking the papers and searching SerpApi for market price & part costs…", "active", "search");
      const seller_claim = { claimed_owners: owners ? Number(owners) : null, raw_text: claim };
      const res = await fetch("/api/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ extraction, seller_claim, asking_price_inr: price ? Number(price) : null }),
      });
      const report = await res.json();
      const n = report.flags?.length ?? 0;
      const marketBit = report.market ? ` · market ₹${Math.round(report.market.low / 1000)}k–₹${Math.round(report.market.high / 1000)}k` : "";
      pushLine("verify", `✓ ${n} issue${n === 1 ? "" : "s"} found${marketBit}`, "done", "search");

      sessionStorage.setItem("papertrail_report", JSON.stringify(report));
      router.push("/report");
    } catch (e) {
      pushLine("error", "Something went wrong reading the documents. Please try again.", "error");
      setError("Something went wrong reading the documents. Please try again.");
      setRunning(false);
      console.error(e);
    }
  }
```

- [ ] **Step 4: Simplify the submit button and render the log**

Replace `const canSubmit = !!rc && !busy;` with `const canSubmit = !!rc && !running;`.

Replace the button block:
```tsx
      <button type="button" onClick={run} disabled={!canSubmit} aria-busy={!!busy}
        className="btn btn-primary" style={{ width: "100%", padding: "15px 20px", fontSize: 15.5 }}>
        {busy ? (
          <>
            <motion.span aria-hidden
              style={{ width: 15, height: 15, borderRadius: "50%", border: "2px solid currentColor", borderTopColor: "transparent", display: "inline-block" }}
              animate={reduce ? undefined : { rotate: 360 }}
              transition={{ duration: 0.7, repeat: Infinity, ease: "linear" }} />
            {busy}
          </>
        ) : "Check this car"}
      </button>

      {!rc && !busy && (
        <p style={{ color: "var(--ink-3)", fontSize: 13, marginTop: 10, textAlign: "center" }}>Add the RC to begin.</p>
      )}
```
with:
```tsx
      <button type="button" onClick={run} disabled={!canSubmit} aria-busy={running}
        className="btn btn-primary" style={{ width: "100%", padding: "15px 20px", fontSize: 15.5 }}>
        {running ? (
          <>
            <motion.span aria-hidden
              style={{ width: 15, height: 15, borderRadius: "50%", border: "2px solid currentColor", borderTopColor: "transparent", display: "inline-block" }}
              animate={reduce ? undefined : { rotate: 360 }}
              transition={{ duration: 0.7, repeat: Infinity, ease: "linear" }} />
            Checking…
          </>
        ) : "Check this car"}
      </button>

      <ActivityLog lines={log} />

      {!rc && !running && (
        <p style={{ color: "var(--ink-3)", fontSize: 13, marginTop: 10, textAlign: "center" }}>Add the RC to begin.</p>
      )}
```

- [ ] **Step 5: Typecheck and run the full suite**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: `TypeScript: No errors found`

Run: `npx vitest run`
Expected: all tests pass (56) — this task touches no tested logic, just UI wiring.

- [ ] **Step 6: Verify in the browser against a real scenario**

With the dev server running, open `/`, upload `dataset/papertrail_test_data/scenarios/S13_multi_flag_demo/images/rc.jpg` (and the service book / insurance pages from the same folder if time allows), fill in the seller-claim fields from the S13 row of the table already shared earlier in this session, and click **Check this car**.

Confirm, in order:
1. A log line appears for the RC with the tilting-document motif while active, then resolves to a `✓ …` line showing the actual extracted make/model.
2. If service/insurance pages were uploaded, one line appears per page, each resolving independently (upload a scenario with 2 service pages to confirm both lines appear, not just one).
3. A final `search`-kind line appears for the SerpApi/cross-check step, resolves to `✓ N issues found · market ₹…k–₹…k`.
4. The browser then navigates to `/report` with the real (not hero) data.
5. Open the terminal running the dev server and confirm `[serpapi] LIVE` and `provider: "openai"` lines appear, matching what the on-screen log claimed — the log must not claim something the network calls didn't actually do.
6. Review Focus #1 (a failed extraction must not break the flow): confirm by reading the code path rather than forcing a real failure — `extractWithLog` always calls `pushLine(id, describeFragment(docType, f), f ? "done" : "error", "scan")` regardless of whether `f` is null, and in `run()` every assignment into `extraction` is guarded (`if (f) extraction.rc = f`, `if (f?.entries) ...`, `if (f) extraction.insurance.push(f)`), so a null fragment from a failed page produces an `"error"` log line and the loop continues to the next file rather than throwing. If you want to see it live instead of reading it, temporarily rename `OPENAI_API_KEY` in `.env` to force every extraction to fail, confirm every uploaded page shows an `"error"` line and the flow still reaches `/api/verify`, then rename the key back.

- [ ] **Step 7: Commit**

```bash
git add app/page.tsx
git commit -m "feat: replace spinner with a truthful, narrated activity log during document reading"
```

---

## Task 6: Docs — accurate README, track disclosure

**Files:**
- Modify: `README.md`

**Interfaces:**
- Consumes: nothing.
- Produces: nothing (documentation only).

- [ ] **Step 1: Rewrite `README.md` to match the current stack**

Replace the full file content with:

```markdown
# PaperTrail — Used-Car Provenance Verifier

Verify a used car's paperwork before you pay. Upload the RC, service book and insurance;
PaperTrail rebuilds the car's timeline, cross-checks it against the public vehicle record,
and hands you a ranked list of problems plus the exact questions to ask the seller.

**The ₹2,000 agency check, done live for under ₹100 — plus the future-cost warning the agency doesn't give.**

## Why it's more than "AI reads documents"

OpenAI vision (gpt-4o-mini) reads the papers, but the value is the reasoning over a reconstructed
**timeline** and the cross-check against ground truth a seller cannot fake — including two
independent live SerpApi lookups, not one:

- **Odometer integrity** — regression, implausible jumps, stagnation
- **Service gaps · insurance lapses**
- **Ownership & identity vs the public record** (the moat — paper says 2 owners, the record shows 3)
- **Traffic violations** (over-speeding challans)
- **Hidden future costs** — big-ticket parts near end of life, **priced live via SerpApi** where a
  real figure can be parsed, falling back to a catalog estimate otherwise (each cost is labeled which)
- **Price comparison** — live SerpApi search for what the car is really worth on the market

Output is a sourced, ranked list of flags — never a vague risk score — plus a full exportable report
and a printable seller-question sheet (two separate, intentional print modes).

## Architecture

Next.js (App Router) on Vercel — frontend + API routes, no database, one throwaway session.

- `lib/engine.ts` — deterministic timeline + 7 reconciliation rules (a verified TS port of
  `dataset/papertrail_test_data/reference/engine.py`, tested against all 13 scenarios).
- `lib/cost/costEngine.ts` — parts lifetime vs the car's real facts, with a live-price override hook.
- `lib/providers/vision/` and `lib/providers/search/` — a strategy-pattern swap between OpenAI/SerpApi
  (current default) and the original Claude/Anakin integration from this project's prior life as an
  Anthropic Opus Build Day winner, switched by the `VISION_PROVIDER`/`SEARCH_PROVIDER` env vars.
- `lib/scrapers/price.ts` and `lib/scrapers/partPrice.ts` — live SerpApi market-price and
  per-part price lookups. `lib/scrapers/enrich.ts` wires both into `/api/verify`; the 13-scenario
  oracle in `lib/engine.ts` is untouched by either.

## Run

```bash
npm install
# .env: OPENAI_API_KEY=<openai key>   SERPAPI_API_KEY=<serpapi key>
npm run dev        # http://localhost:3000
npm test           # tests incl. all 13 reference scenarios + live-price parsing
```

Upload from `dataset/papertrail_test_data/scenarios/S13_multi_flag_demo/images/` for the full demo,
or open `/report` for the bundled hero report.

## Deploy

```bash
npx vercel --prod
# set OPENAI_API_KEY and SERPAPI_API_KEY in the Vercel dashboard
```

## Disclosure

This project started as **PaperTrail**, a winning submission at an Anthropic Opus Build Day, built on
Claude Opus vision + the Anakin web-search API. For the **SerpApi India Hackathon** (track: Commerce &
Market Intelligence) the AI and search layers were swapped to OpenAI gpt-4o-mini and SerpApi — both
now materially load-bearing in two independent features (market price comps and per-part live
pricing) — while the original Claude/Anakin code remains in the repo, switchable via env var, per
the hackathon's existing-project disclosure rule. AI tools used in building this: Claude Code
(implementation), OpenAI gpt-4o-mini (in-product document extraction).
```

- [ ] **Step 2: Verify the file reads correctly**

Run: `node -e "console.log(require('fs').readFileSync('README.md','utf8').length)"`
Expected: a non-zero byte count (sanity check the write succeeded and isn't empty).

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: update README for the OpenAI/SerpApi stack and hackathon disclosure"
```

---

## Next steps after this plan (not part of it)

Once Tasks 1–6 are verified, the user records the under-3-minute demo video (per the SerpApi India
Hackathon submission checklist) and submits: public GitHub repo, demo video, track = Commerce &
Market Intelligence, prior-project disclosure (text above), AI tools used (text above). No further
code changes are anticipated in this plan's scope — if the video recording surfaces a bug, treat it
as a new, separately-scoped fix rather than reopening these tasks.
