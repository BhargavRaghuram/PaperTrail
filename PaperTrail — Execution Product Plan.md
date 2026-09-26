# PaperTrail — Used-Car Provenance Verifier

## 1. Product in one sentence

PaperTrail helps a used-car buyer verify a car's paper trail by extracting information from RC, service-book, and insurance documents, building a chronological timeline, and detecting inconsistencies that the buyer should question.

---

# 2. Core Product Flow

```text
                 BUYER
                   │
                   ▼
        ┌──────────────────┐
        │   Upload Photos  │
        │                  │
        │ RC                │
        │ Service Book     │
        │ Insurance        │
        └────────┬─────────┘
                 │
                 ▼
        ┌──────────────────┐
        │ Claude Vision    │
        │                  │
        │ Extract facts    │
        └────────┬─────────┘
                 │
                 ▼
        ┌──────────────────┐
        │ Structured JSON  │
        │                  │
        │ dates            │
        │ mileage          │
        │ owners           │
        │ insurance        │
        └────────┬─────────┘
                 │
                 ▼
        ┌──────────────────┐
        │ Timeline Builder │
        │                  │
        │ Normal code      │
        └────────┬─────────┘
                 │
                 ▼
        ┌─────────────────────┐
        │ Reconciliation Agent│
        │                     │
        │ Does this history   │
        │ make sense?         │
        └──────────┬──────────┘
                   │
                   ▼
        ┌──────────────────┐
        │   Discrepancies  │
        │                  │
        │ 🚨 Mileage       │
        │ ⚠ Service gap    │
        │ ⚠ Insurance      │
        └────────┬─────────┘
                 │
                 ▼
        ┌──────────────────┐
        │ Questions for    │
        │ Seller           │
        └──────────────────┘
```

The key principle:

> **Claude reads the documents, but the product value comes from Claude reasoning over the reconstructed timeline.**

---

# 3. MVP Architecture

```text
┌─────────────────────────────────────────────┐
│                  FRONTEND                   │
│                                             │
│  Upload Documents → Processing → Report     │
└──────────────────────┬──────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────┐
│                  BACKEND                    │
│                                             │
│  Upload Handler                             │
│       │                                     │
│       ▼                                     │
│  Extraction Service                         │
│       │                                     │
│       ▼                                     │
│  Timeline Builder                           │
│       │                                     │
│       ▼                                     │
│  Reconciliation Service                     │
│       │                                     │
│       ▼                                     │
│  Question Generator                         │
└──────────────────────┬──────────────────────┘
                       │
                       ▼
              ┌────────────────┐
              │ Claude API      │
              │                │
              │ Vision         │
              │ Reasoning      │
              └────────────────┘
```

No database is required for the MVP.

Each analysis is a **single session**.

```text
Session
   │
   ├── uploaded documents
   ├── extracted facts
   ├── timeline
   ├── flags
   └── questions

             ↓

        Discard session
```

Do not build accounts, saved vehicles, user history, or persistent personal data for the MVP.

---

# 4. Document Processing Architecture

```text
                Uploaded Images
                      │
          ┌───────────┼───────────┐
          ▼           ▼           ▼
        RC        Service      Insurance
        │           Book          │
        │             │           │
        ▼             ▼           ▼
   Claude Vision  Claude Vision  Claude Vision
        │             │           │
        ▼             ▼           ▼
     RC JSON      Service JSON  Insurance JSON
          \           |           /
           \          |          /
            └─────────┴─────────┘
                      │
                      ▼
                Timeline Builder
```

Extraction must produce **structured JSON**, not prose.

Example:

```json
{
  "document_type": "service_book",
  "entries": [
    {
      "date": "2021-06-02",
      "odometer_km": 34200,
      "source": "service_book_p2",
      "confidence": "high"
    }
  ]
}
```

If Claude cannot confidently read something:

```text
Do NOT guess.

        ↓

Mark field low-confidence

        ↓

Exclude from reasoning

        ↓

Tell user:
"Page 4 contains unreadable fields.
Please retake the photo."
```

---

# 5. Timeline Builder

This component should be **normal application code**, not another AI call.

```text
RC JSON
   │
Service JSON
   │
Insurance JSON
   │
   ▼
┌────────────────────────┐
│ Timeline Builder       │
│                        │
│ 1. Collect events      │
│ 2. Normalize dates     │
│ 3. Normalize mileage   │
│ 4. Sort chronologically │
└───────────┬────────────┘
            │
            ▼
       Unified Timeline
```

Example:

```text
2019-03-14
Registration
Mileage: 0
Source: RC
        │
        ▼
2021-06-02
Service
Mileage: 34,200
Source: Service Book
        │
        ▼
2023-01-19
Service
Mileage: 31,800
Source: Service Book
```

The Timeline Builder should be deliberately simple.

---

# 6. Reconciliation Engine — THE CORE

```text
                 Timeline
                    │
                    ▼
        ┌──────────────────────┐
        │ Reconciliation Agent │
        │                      │
        │ Compare events       │
        │ Look for anomalies   │
        │ Apply rules          │
        └──────────┬───────────┘
                   │
       ┌───────────┼────────────┐
       ▼           ▼            ▼
   Mileage      Service      Insurance
   checks       checks       checks
       │           │            │
       └───────────┼────────────┘
                   ▼
             Flagged Issues
```

### MVP rules

#### Rule 1 — Odometer regression

```text
Earlier: 34,200 km
Later:   31,800 km

31,800 < 34,200

        ↓

🚨 HIGH
Odometer regression
```

#### Rule 2 — Implausible mileage jump

```text
Event A
10,000 km
   │
   │
   │ unusually large increase
   ▼
Event B
100,000 km

        ↓

⚠ MEDIUM
Implausible mileage jump
```

The PRD specifies approximately **150 km/day sustained average** as the threshold.

#### Rule 3 — Service gap

```text
Service
   │
   │ > 12 months
   │ OR
   │ > 15,000 km
   ▼
Service

        ↓

⚠ MEDIUM
Service gap
```

#### Rule 4 — Insurance lapse

```text
Policy A
──────────────
       │
       │ GAP
       │
       ▼
──────────────
Policy B

        ↓

⚠ MEDIUM
Insurance lapse
```

#### Rule 5 — Ownership mismatch

Compare:

```text
RC ownership records
          +
Seller's claim
          │
          ▼
   Ownership mismatch?
```

#### Rule 6 — Missing service history

```text
No service book
       OR
< 2 dated entries

       ↓

LOW

"No maintenance record
 available — treat as
 unverified."
```

These rules are the documented MVP logic from the original plan.

---

# 7. Reconciliation Output

The agent should never return vague prose.

Return structured data:

```json
{
  "flags": [
    {
      "rule": "odometer_regression",
      "severity": "high",
      "entries": [
        "2021-06-02",
        "2023-01-19"
      ],
      "explanation": "Mileage decreased between two dated service records."
    }
  ]
}
```

The frontend can then render:

```text
🚨 HIGH — Odometer Regression

34,200 km
     ↓
31,800 km

Mileage recorded in 2023 is lower than
the mileage recorded in 2021.
```

---

# 8. Question Generator

Do NOT use Claude unless necessary.

Use a simple mapping:

```text
FLAG                         QUESTION
────────────────────────────────────────────────────────

odometer_regression    →    "Can you explain why the
                             recorded mileage went down?"

service_gap            →    "What happened during this
                             gap in the service history?"

insurance_lapse        →    "Why was there a gap between
                             these insurance policies?"

ownership_mismatch     →    "Can you clarify the number
                             of previous owners?"
```

Architecture:

```text
Flag
 │
 ▼
Flag Type
 │
 ▼
Question Template
 │
 ▼
Buyer Question
```

This makes the output predictable and cheap.

---

# 9. Frontend Screens

Keep the UI extremely small.

## Screen 1 — Upload

```text
┌─────────────────────────────┐
│        PAPERTRAIL           │
│                             │
│ Verify a used car's         │
│ documented history.         │
│                             │
│ [ Upload RC ]               │
│                             │
│ [ Upload Service Book ]     │
│                             │
│ [ Upload Insurance ]        │
│       Optional              │
│                             │
│ Seller's claim:             │
│ [ Single owner, no ... ]    │
│                             │
│       [ CHECK CAR ]         │
└─────────────────────────────┘
```

---

## Screen 2 — Processing

```text
┌─────────────────────────────┐
│       CHECKING CAR...       │
│                             │
│ ✓ Reading RC                │
│ ✓ Reading service records   │
│ ✓ Building timeline         │
│ ● Checking inconsistencies  │
│                             │
└─────────────────────────────┘
```

---

## Screen 3 — Timeline

```text
┌─────────────────────────────┐
│       CAR TIMELINE          │
│                             │
│ 2019                        │
│ Registration                │
│                             │
│        ↓                    │
│                             │
│ 2021                        │
│ Service — 34,200 km         │
│                             │
│        ↓                    │
│                             │
│ 2023                        │
│ Service — 31,800 km         │
└─────────────────────────────┘
```

---

## Screen 4 — Issues

```text
┌─────────────────────────────┐
│       ISSUES FOUND          │
│                             │
│ 🚨 HIGH                     │
│ Odometer regression         │
│                             │
│ 34,200 → 31,800 km          │
│                             │
│ ⚠ MEDIUM                   │
│ Service history gap         │
│                             │
└─────────────────────────────┘
```

---

## Screen 5 — Seller Questions

```text
┌─────────────────────────────┐
│     QUESTIONS FOR SELLER    │
│                             │
│ 1. Why did the recorded    │
│    mileage decrease?        │
│                             │
│ 2. What happened during    │
│    the service gap?         │
│                             │
│        [ PRINT / SHARE ]    │
└─────────────────────────────┘
```

This is the final user-facing value: **specific questions backed by specific evidence**, rather than a generic score.

---

# 10. Recommended Build Order

Do NOT build everything simultaneously.

## Phase 1 — Prove Claude extraction

```text
Real RC
  +
Real Service Book
       │
       ▼
Claude Vision
       │
       ▼
Correct JSON?
```

This is the first blocker.

Especially test a **real handwritten Indian service booklet**, because the PRD explicitly identifies extraction quality there as an unknown.

---

## Phase 2 — Build timeline

```text
JSON
 ↓
Timeline Builder
 ↓
Sorted events
```

No AI required.

---

## Phase 3 — Build reconciliation

Start with only:

```text
1. Odometer regression
2. Implausible mileage jump
3. Service gap
```

These are enough to demonstrate the concept.

---

## Phase 4 — Build report UI

```text
Timeline
   ↓
Flags
   ↓
Questions
```

---

## Phase 5 — Add remaining rules

```text
Insurance lapse
Ownership mismatch
Missing history
Document identity mismatch
```

---

# 11. Claude Code Execution Plan

Give Claude Code the project in these stages.

```text
STEP 1
"Set up the project skeleton and upload flow."

        ↓

STEP 2
"Implement Claude document extraction
with strict JSON schemas."

        ↓

STEP 3
"Implement Timeline Builder using
normal deterministic code."

        ↓

STEP 4
"Implement reconciliation rules and
structured flag output."

        ↓

STEP 5
"Implement question generation."

        ↓

STEP 6
"Build the timeline/report UI."

        ↓

STEP 7
"Test the complete flow using
real RC + service-book images."

        ↓

STEP 8
"Polish the 2-minute demo."
```

### Important Claude Code rule

Don't ask Claude Code:

> "Build PaperTrail."

Instead, give it **one phase at a time**, verify the result, then move to the next phase.

---

# 12. What NOT to Build

For the buildathon MVP:

```text
❌ Login
❌ User accounts
❌ Vehicle database
❌ Persistent history
❌ VAHAN scraping
❌ Parivahan API integration
❌ Insurance claim lookup
❌ Mechanical inspection
❌ Document forgery detection
❌ Fancy risk score
❌ Complex microservices
```

The original plan explicitly keeps these outside the MVP.

---

# 13. Final Architecture

```text
                         PAPERTRAIL
                              │
                              ▼
                    ┌─────────────────┐
                    │   React / UI    │
                    │                 │
                    │ Upload documents│
                    └────────┬────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │     Backend     │
                    └────────┬────────┘
                             │
              ┌──────────────┴──────────────┐
              │                             │
              ▼                             ▼
      ┌───────────────┐             ┌────────────────┐
      │ Claude Vision │             │ Session Data   │
      │               │             │                │
      │ Extract facts │             │ JSON only      │
      └───────┬───────┘             └───────┬────────┘
              │                             │
              └──────────────┬──────────────┘
                             ▼
                    ┌─────────────────┐
                    │ Timeline Builder│
                    │                 │
                    │ Deterministic   │
                    │ code            │
                    └────────┬────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │ Reconciliation  │
                    │     Agent       │
                    │                 │
                    │ Claude reasoning│
                    └────────┬────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │ Flagged Issues  │
                    └────────┬────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │ Question        │
                    │ Generator       │
                    └────────┬────────┘
                             │
                             ▼
                 ┌────────────────────────┐
                 │       FINAL REPORT     │
                 │                        │
                 │ Timeline               │
                 │ 🚨 Flags               │
                 │ ❓ Seller Questions    │
                 └────────────────────────┘
```

## The buildathon priority

```text
                    MOST IMPORTANT
                         ▲
                         │
                 Reconciliation
                         │
                    Timeline
                         │
                    Extraction
                         │
                       UI
                         │
                 Everything else
                         ▼
                    LEAST IMPORTANT
```

**If time runs out:** a working extraction → timeline → reconciliation demo with **3 excellent rules** is better than a huge application with ten half-working features.