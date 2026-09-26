# PaperTrail — Judge's Brief

> **Shareable artifact (peak-detail version):** https://claude.ai/code/artifact/47631638-1129-4147-bec7-b777360576fc
> This markdown is the same content to read/explain from.

**One line:** PaperTrail reads a used car's papers and catches what a human skim misses — then hands the buyer the exact questions to ask before paying ₹3–5 lakh.

---

## The problem (named user, specific failure)

A used-car buyer in India, phone in one hand and the seller's paperwork in the other, about to hand over ₹3–5 lakh. **India has no Carfax.** The data that answers "is this car what the seller says" exists — RC book, service booklet, insurance — but it's on paper across three documents that were never meant to be cross-checked. Agencies charge **₹2,000** to reconcile them by hand.

**PaperTrail does the ₹2,000 agency check live for under ₹100 — plus the future-cost warning the agency never gives.**

---

## How it's judged — the four axes, answered honestly

### 1 · New capability — *the core bet*
A scanner app OCRs a document. PaperTrail **reasons across a reconstructed timeline, and against the live web** — genuine judgment under messy, incomplete real-world data, which needs a frontier model.
- Catches a contradiction that lives *between* three documents, not in any one: "June 2021 says 34,200 km, Jan 2023 says 31,800 km." No OCR finds that.
- Cross-checks the paper against ground truth it scrapes live (market price; for a real reg, the public record and challans): "papers say 2 owners, the record shows 3." **Impossible to reproduce by uploading a photo to a chatbot.**
- Reads real handwritten Indian service booklets with Claude Opus vision into strict JSON.

### 2 · It works — live — *proven*
- **50/50 automated tests green**, including all **13** reconciliation scenarios matched exactly to ground truth.
- Live Claude Opus vision extraction confirmed on real document images.
- Live Anakin web scraping confirmed — real Cars24 & Spinny listings, credits visibly consumed.
- Production build passes; deployed to a hosted link.

### 3 · Keep or share — *strongest axis*
"I'm buying a used car this weekend — send this to my cousin." A real ₹3–5 lakh decision millions make yearly, with no existing tool. You'd use it next week and forward it mid-purchase.

### 4 · Clarity of demo — *under 60 seconds*
Upload three photos → timeline draws in → the odometer **drops** on screen (physically impossible, instantly legible) → sourced flags → printable question sheet. The catch is visual; no explanation needed.

---

## The pipeline (where the model is load-bearing)

| # | Step | Who |
|---|---|---|
| 1 | Extract each document photo → strict JSON (unreadable = excluded, never guessed) | **Claude Opus vision** |
| 2 | Merge registration/services/insurance/challans into one timeline | Deterministic code |
| 3 | Reconcile — 7 sourced, severity-ranked rules | Deterministic (verified) |
| 4 | Cross-check the live web — market price (+ public record/challans for a real reg) | **Anakin API** |
| 5 | Forecast hidden costs — parts near end-of-life for the car's age/km | Parts catalog |
| 6 | Turn every flag into one printable seller question | Template map |

Two model touch-points (vision + reasoning), one deterministic core, one live-web moat. The model does judgment; nothing else.

---

## The effort centerpiece — live web scraping, with receipts

**It really scrapes Cars24 and Spinny via Anakin — not mock data.**

Live call captured (`HTTP 200`, 993 ms, 5 results):
```
[anakin] LIVE /search <- 200 in 993ms · 5 results
  prompt: "used 2018 Maruti Dzire price second hand car India
           site:cars24.com OR site:spinny.com OR site:cardekho.com"
```
Real listings returned:
- **Cars24** — Used 2018 Maruti Dzire VXI Manual · Petrol · 64,355 km
- **Cars24** — Used 2018 Maruti Dzire VXI AMT Automatic · Petrol · 54,300 km
- **Spinny** — Used Dzire Cars in Pune · 15 certified · from ₹2.56 L
- **Cars24** — 11,297 Used Maruti Cars in India · from ₹0.40 L

**Three ways a judge can verify it live:**
- **A · Server log** — every call prints `[anakin] LIVE /search <- 200` in the terminal (missing key → `SKIP`; failure → `HTTP 4xx (fallback)`).
- **B · UI badge** — the market section shows a green **● Live via Anakin** pill, rendered only when `market.source === "live"`.
- **C · Credits** — Anakin bills 1 credit/call; balance dropped **5,300 → 5,275** across the session (25 real calls; a mock burns 0).

**Why it's not in the browser Network tab:** the Anakin call is server-to-server (our API route → api.anakin.io), so the key never touches the client. Correct architecture — invisible to the browser, visible in the server log.

---

## Full honesty — live vs. sample

| Signal | Source in the demo | |
|---|---|---|
| Document facts (RC/service/insurance) | Claude Opus vision on your uploads | **Live** |
| Used-car market price | Anakin → Cars24 / Spinny / CarDekho | **Live** |
| Reconciliation & flags | Deterministic engine, 13-scenario oracle | **Live** |
| Hidden-cost forecast | Parts catalog vs. real age/km | **Live** |
| Public-record owners & challans | Sample — demo reg is synthetic; a real reg is scraped the same way | Sample |

The demo car is synthetic test data (non-existent RTO code), so no real government record exists for it — we say so out loud.

---

## The 90 seconds (demo first, then who it's for)

- **0:00** "This car's papers say single owner, full service history." → upload; timeline draws in.
- **0:20** "Watch the odometer — it goes down. A car's odometer physically cannot." → regression node drops, pulses red.
- **0:40** "Papers say two owners; the public record shows three. A seller can fake a document, not the record." → flags + live market comparison.
- **1:05** "It hands the buyer the exact questions to ask — and warns the alternator will cost ₹12,000 next year." → question sheet + hidden costs.
- **1:25** "For anyone buying a used car in India, where there's no Carfax. The ₹2,000 agency check, live, under ₹100." → hosted link.

---

## Scope, stated plainly

- **Shipped & tested:** vision extraction, timeline, 7 reconciliation rules, question sheet, hidden-cost forecast.
- **Shipped & live:** market price comparison (Cars24 / Spinny / CarDekho).
- **Wired, live for real regs:** public-record owners & challans.
- **Out of scope (said out loud):** document authenticity / forgery — we check internal consistency, not forensic validity.

---

*Next.js on Vercel · Claude Opus vision + reasoning · Anakin.io live web API · no database, one throwaway session.*
