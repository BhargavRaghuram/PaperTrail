# PaperTrail — Used-Car Provenance Verifier
**Opus Build Day PRD — Breakthrough Track**
*(working name, change freely)*

---

## 0. Why This Wins

Every judged buildathon idea gets filtered on the same four things,
whether the rubric says so or not: a named user, a specific failure,
whether the model is actually load-bearing, and whether it's demoable
in the room. Walk through this idea against each one, honestly,
including the counter-argument.

**Named user.** Not "car buyers" — one person, mid-transaction, about to
hand over ₹3–5 lakh for a used hatchback bought off OLX or Cars24,
holding a phone in one hand and the seller's paperwork in the other.
That specificity is the whole pitch. If you can't picture the person,
the idea is still too abstract.

**Specific failure.** India has no Carfax. The data that would answer
"is this car what the seller says it is" already exists — RC book,
service booklet, insurance papers — but it's on paper, scattered across
three documents that were never meant to be cross-checked against each
other. Nobody reconciles them because doing it by hand is tedious, not
because it's impossible. That gap is real and it's ours to close.

**Is Claude load-bearing, or decorative?** This is the question to be
honest about. A tool that just OCRs a service booklet and displays the
text is not a Claude product — it's a scanner app. The part that
actually needs a model is the *reconciliation*: does this odometer
reading make sense given the date and the previous reading? Does a
9-month gap in the service record with no matching increase in mileage
suggest the car sat unused, or that servicing happened off-book after
undisclosed damage? That's judgment under incomplete, messy, real-world
data — not extraction. **Build the reconciliation engine first.** If the
weekend runs short, a working reconciliation on manually-typed data
beats a beautiful OCR pipeline with no judgment layer behind it.

**India-shaped.** Fragmented paper records, no unified vehicle-history
API, multiple document formats depending on state and dealer — this
problem doesn't exist in the same shape anywhere with a Carfax
equivalent. It's not a global idea wearing an Indian costume.

**Demoable.** One real car. Bring an actual RC book and service booklet
(yours, a friend's, a relative's) as the demo dataset. Live extraction,
live reconciliation, live flagged output, on stage, in two minutes.

**The honest risk:** a few other teams will also pitch "AI reads
documents and finds problems." What makes this stand out isn't the
extraction — everyone will have that. It's a reconciliation engine that
reasons over a *timeline*, not a document, and outputs a decision, not
a transcript. Say that explicitly in the pitch. Don't let the demo lead
with "look, it read the text" — lead with "look, it caught something a
human skim would have missed."

---

## 1. Problem

A used-car buyer in India has no way to verify a seller's claims before
paying. The RC book, service booklet, and insurance papers each hold
partial evidence — odometer readings, service dates, ownership
transfers — but nobody cross-checks them against each other. Buyers
either trust the seller or pay for a mechanic's inspection that checks
the car, not the paper trail. Undisclosed accidents and mileage
rollbacks surface as expensive surprises months later.

## 2. Goals

- Given photos of a car's paper documents, produce a single
  chronological timeline of everything those documents claim.
- Surface specific inconsistencies in that timeline — not a generic
  "risk score," but named, sourced discrepancies a buyer can act on.
- Output a short list of pointed questions the buyer can put to the
  seller before paying, each one tied to a specific flagged
  inconsistency.
- Demo end-to-end on one real vehicle's documents within the build
  window.

## 3. Scope

**In scope**
- Ingesting photos/scans of: RC book (front + back), service booklet
  pages, insurance policy document.
- Extracting structured facts from each: dates, odometer readings,
  registration/chassis/engine numbers, ownership records, policy
  validity windows.
- Building one merged timeline from all three sources.
- Detecting a fixed set of inconsistency patterns (Section 6).
- Producing a ranked, sourced list of flags and a plain-language
  question sheet.

**Out of scope — explicitly**
- Verifying document *authenticity* (is this RC forged?). We check
  internal consistency, not forensic validity. Say this out loud in
  the pitch before a judge asks it.
- Live lookup against VAHAN/Parivahan or any government database. No
  time to get API access this weekend; note it as a Phase 2 direction,
  don't attempt to scrape it live.
- Mechanical inspection of the car itself.
- Insurance claim history (requires insurer access we don't have).
  Mention it as the natural next data source, don't try to fake it.
- Any storage of the buyer's or seller's personal data beyond the
  session. This is a single-use check, not a database of cars.

## 4. How It Works — User Perspective

The buyer opens the tool on their phone at the point of sale, photographs
the RC book, the service booklet's pages, and the insurance papers if
the seller has them. Within a minute they get back a timeline of the
car's documented life and a short list of specific things that don't
add up — each with a plain-language question to ask the seller on the
spot, before any money changes hands. No login, no saved history, no
account. One session, one car, one decision.

## 5. High-Level Architecture

```mermaid
flowchart LR
    A[Capture UI<br/>photo upload: RC, service book, insurance] --> B[Extraction Agent<br/>Claude vision, per-document]
    B --> C[Structured Facts<br/>JSON per document type]
    C --> D[Timeline Builder<br/>merges facts into one<br/>chronological sequence]
    D --> E[Reconciliation Agent<br/>Claude reasoning over timeline<br/>THE DIFFERENTIATOR]
    E --> F[Flagged Discrepancies<br/>each sourced + confidence-scored]
    F --> G[Question Generator<br/>flag → plain-language ask]
    G --> H[Report View<br/>timeline + flags + question sheet]
```

**Component notes:**

- **Extraction Agent** — one Claude vision call per document, prompted
  per document type (RC book has a fixed field layout; a service
  booklet does not, so its prompt has to extract loosely and tag
  uncertainty). Output is strict JSON, not prose, so the Timeline
  Builder never has to parse natural language.

- **Timeline Builder** — plain code, not a model call. Merges dated
  events from all three JSON outputs into one sorted sequence. This is
  the least interesting part of the system and should take the least
  time to build. Don't over-invest here.

- **Reconciliation Agent — this is the product.** Takes the full
  timeline and reasons over it, not field-by-field but sequence-by-
  sequence: does event N make sense given event N-1? This is a Claude
  call with the ruleset from Section 6 in the prompt, asked to return
  structured flags, each with a confidence label and a pointer to
  which two timeline entries triggered it. If you only have time to
  build one part well, build this one well.

- **Question Generator** — small, templated. Each flag type maps to a
  question phrasing. Doesn't need to be a model call at all if time is
  short — a lookup table from flag type to question template is fine
  and arguably more reliable.

## 6. Core Logic — The Reconciliation Engine

This is the section to spend the most build time on, and the one to
walk a judge through in detail if asked.

**Signals available:**
- Odometer reading + date, from both RC (if re-registered) and each
  service booklet entry.
- Ownership transfer dates and count, from RC.
- Insurance policy start/end dates.
- Service center visit dates.

**Flag rules (each fires independently, all run every time):**

| Rule | Trigger | Flag severity |
|---|---|---|
| Odometer regression | A later-dated entry shows lower mileage than an earlier one | High |
| Implausible mileage jump | Mileage increase between two dated entries exceeds ~150 km/day sustained average | Medium |
| Service gap | Gap between consecutive service entries exceeds 12 months or 15,000 km with no matching entry | Medium |
| Insurance lapse | A gap exists between one policy's end date and the next one's start date | Medium |
| Ownership mismatch | Number of transfers on RC doesn't match what the seller's story implies (buyer enters seller's claim as one input field) | High |
| Missing service history entirely | No service booklet provided or booklet has fewer than 2 dated entries | Low — flagged as "no data" risk, not an active inconsistency |

Each flag that fires returns: the rule name, the two timeline entries
that triggered it, a one-line plain-language explanation, and severity.
Severity feeds directly into how the final question sheet is ordered —
High first.

**Deliberately not scored as a single number.** A single "risk score"
invites the judge to ask how it's weighted and invites the buyer to
either over-trust or ignore it. A sourced list of specific flags is
more honest and more useful, and it's more defensible under
questioning — "why did it say 72%" has no good answer; "why does it
flag this" always does.

## 7. Input / Output

**Input**
- `rc_images`: 1–2 photos (front/back of RC book)
- `service_book_images`: N photos (as many pages as available)
- `insurance_doc_image`: 0–1 photo (optional)
- `seller_claim`: free-text field, buyer types what the seller told
  them (e.g. "single owner, no accidents") — used only for the
  ownership-mismatch check

**Output**
```json
{
  "timeline": [
    {"date": "2019-03-14", "event": "registration", "odometer_km": 0, "source": "RC"},
    {"date": "2021-06-02", "event": "service", "odometer_km": 34200, "source": "service_book_p2"},
    {"date": "2023-01-19", "event": "service", "odometer_km": 31800, "source": "service_book_p5"}
  ],
  "flags": [
    {
      "rule": "odometer_regression",
      "severity": "High",
      "entries": ["2021-06-02", "2023-01-19"],
      "explanation": "Mileage recorded on Jan 2023 is lower than mileage recorded in June 2021.",
      "question": "Can you explain why the recorded mileage went down between these two service visits?"
    }
  ]
}
```
Report view renders this as: timeline (chronological cards) → flags
(severity-sorted) → printable question sheet (just the questions,
nothing else — this is the thing the buyer actually holds up at the
sale).

## 8. Failure Modes

| Scenario | Behaviour |
|---|---|
| Photo is blurry/illegible | Extraction Agent returns a per-field confidence flag; low-confidence fields are excluded from timeline rather than guessed, and the report says "N fields unreadable — retake photo of page X" |
| Service booklet is handwritten in a regional language | Extraction prompt handles this as-is (Claude vision handles handwriting reasonably); if extraction confidence is low, same as above — excluded, not guessed |
| No service booklet at all | Missing-history rule fires; timeline shows only RC-derived events; report explicitly states "no maintenance record available — treat as unverified" rather than silently having a thin report |
| Seller's claim field is left blank | Ownership-mismatch rule simply doesn't run; every other rule still does |
| Document is a forgery | Out of scope (Section 3) — internal consistency checks may still catch a *badly* forged document by accident, but this is not a claim to make in the pitch |
| Two documents disagree on registration/chassis number entirely | Highest-severity flag of all — this means the documents may not even belong to the same vehicle; surface this before anything else |

## 9. Open Questions

1. **Do we type sample data or photograph a real document for the demo?**
   Recommendation: photograph a real RC + service booklet (yours or a
   teammate's) ahead of time and have it ready — a live demo on a real,
   imperfect document is far more convincing than a clean synthetic
   one. Not a blocker, but do this *before* the 26th, not on the day.

2. **How many flag rules do we actually build vs. describe?**
   Recommendation: build odometer regression, implausible jump, and
   service gap fully — those three tell the whole story on their own.
   Describe insurance lapse and ownership mismatch as "designed, not
   yet wired" if time runs short. Don't silently drop them from the
   pitch; say what's built vs. designed.

3. **Team split, once formed tomorrow.**
   Recommendation: one person owns Extraction Agent prompts (per
   document type), one owns Timeline Builder + Reconciliation Agent
   (the core logic, Section 6), one owns Report View. This is a
   blocking decision — settle it in the first 20 minutes on the day,
   not after breakfast ends.

4. **What happens if extraction on Claude Opus vision misreads a
   handwritten Indian service booklet badly?**
   Not fully known until tested against a real one. Recommendation:
   test this first, before building anything else — if extraction
   quality on a real handwritten booklet is poor, the whole pitch
   needs a fallback demo path (typed-in data with photographed
   documents shown as "what this would ingest"). This blocks nothing
   else in the architecture, but it should be the very first thing
   tried on the day.
