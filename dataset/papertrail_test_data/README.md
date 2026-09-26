# PaperTrail — MVP test dataset (synthetic)

13 scenarios, 59 phone-style document photos (RC, handwritten service-book pages, insurance schedules),
each with ground-truth extraction JSON, the expected timeline, and the expected flags + seller questions.

**Everything here is fictional.** Names, dealers and insurers are invented; registration numbers use RTO code `99`
(which doesn't exist) and every image carries a "SYNTHETIC TEST DATA" footer.

## Scenario matrix

| Scenario | What it tests | Expected rules fired |
|---|---|---|
| `S01_clean_single_owner` | Clean history — no flags expected | — none — |
| `S02_odometer_regression` | Odometer regression (the PRD example: 34,200 → 31,800) | odometer_regression |
| `S03_implausible_jump` | Implausible mileage jump (10,000 → 100,000 km in ~6.5 months) | implausible_mileage_jump, service_gap |
| `S04_service_gap_time` | Service gap by time (≈21 months) — insurance NOT uploaded | service_gap |
| `S05_service_gap_km` | Service gap by distance (18,500 km between services, <12 months) | service_gap |
| `S06_insurance_lapse` | Insurance lapse (76 days uninsured, NCB reset to 0%) | insurance_lapse |
| `S07_ownership_mismatch` | Ownership mismatch (RC owner serial 3, seller says single owner) | ownership_mismatch |
| `S08_missing_service_history` | Missing service history (only one dated entry) | missing_service_history |
| `S09_document_identity_mismatch` | Document identity mismatch (service book chassis ≠ RC chassis) | document_identity_mismatch |
| `S10_unreadable_entry` | Unreadable odometer (ink blot) + blurry photo | — none — |
| `S11_boundaries_and_formats` | Boundary values + messy formats — no flags expected | — none — |
| `S12_meter_replaced_documented` | Regression WITH a documented instrument-cluster replacement | odometer_regression |
| `S13_multi_flag_demo` | Kitchen sink — regression + service gap + insurance lapse + ownership mismatch | insurance_lapse, odometer_regression, ownership_mismatch, service_gap |

Suggested use by build phase: **Phase 1** (extraction) → run Claude Vision on `images/` and score with
`reference/eval_extraction.py`. **Phase 2–3** (timeline + rules) → skip vision entirely and feed
`fixtures/all_scenarios.json` into your code. **Demo** → S13 (four flags from one car) or S02 (the PRD example).

## Layout

```
scenarios/<id>/
  images/            rc.jpg, service_book_pN.jpg, insurance_N.jpg   ← upload these
  seller_claim.json  {claimed_owners, raw_text}                      ← the "Seller's claim" box
  expected/extraction.json   ground truth for Claude Vision output
  expected/timeline.json     what the deterministic Timeline Builder should produce
  expected/report.json       flags + unreadable_notices + seller questions
fixtures/all_scenarios.json  all extractions + expected rules in one file (unit tests, no vision needed)
schemas/extraction.schema.json   JSON Schema for the extraction step (use it in your prompt / validation)
reference/engine.py          reference timeline builder + 7 rules + question templates
reference/test_reference.py  pytest suite (26 tests) — point it at your own module
reference/eval_extraction.py score a vision extraction:  python reference/eval_extraction.py S02_odometer_regression my.json
manifest.csv                 every image with its scenario and doc type
```

## Rule parameters used for the expected outputs

odometer_regression (HIGH): any later dated reading lower than an earlier one.
implausible_mileage_jump (MEDIUM): > 150 km/day between consecutive readings.
service_gap (MEDIUM): > 365 days **or** > 15,000 km between consecutive dated services (strictly greater — S11 sits exactly on both limits and must not fire). The km branch only compares entries whose odometer is readable.
insurance_lapse (MEDIUM): next policy starts more than 1 day after the previous one ends.
ownership_mismatch (HIGH — the plan doesn't fix a severity, adjust if you like): RC owner serial ≠ seller's claimed owner count.
missing_service_history (LOW): fewer than 2 dated service entries.
document_identity_mismatch (HIGH): registration or chassis number on service book/insurance ≠ RC (compared ignoring spaces/hyphens).
Registration is treated as odometer 0 (new vehicle). Low-confidence fields are excluded from all rules and produce an "unreadable, please retake" notice.

## Edge cases worth knowing about

S03 fires both a jump and a km-based service gap on the same pair — decide whether the UI groups them.
S10's ink blot hides 22,800 km; a model that guesses "12,800" will invent a false regression. Ground truth marks it low-confidence and the true value is kept in `_eval_true_odometer_km` for scoring only.
S11 mixes date formats (`15/01/21`, `15-Jan-2022`, `15.1.22`, `3.8.22`) — Indian DD/MM order throughout — plus `34.2k` and `41000 km` odometer styles, a same-day duplicate row, reversed page order, and a page photographed sideways.
S12 is a genuine regression (cluster replaced, dealer note on the page). The rule still fires; the interesting test is whether your Claude reasoning step quotes the note and asks for the replacement job card rather than calling it tampering.
S08: one row has a dealer stamp but no date/km — it must not be counted as a dated entry.
S04 has no insurance uploaded (optional input path).

## What this dataset can't do

It won't tell you how Claude handles a *real* handwritten Indian service booklet — faded carbon ink, overwritten numbers,
multilingual stamps. The plan calls that the first blocker, so photograph two or three real RCs/service books
(yours, family, friends — mask names and addresses) and add them as extra scenarios in the same folder shape.
Regenerate/extend the synthetic set by editing `generator/scenarios.py` and running `python generator/build.py`.
