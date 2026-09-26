# PaperTrail — Used-Car Provenance Verifier

Verify a used car's paperwork before you pay. Upload the RC, service book and insurance;
PaperTrail rebuilds the car's timeline, cross-checks it against the public vehicle record,
and hands you a ranked list of problems plus the exact questions to ask the seller.

**The ₹2,000 agency check, done live for under ₹100 — plus the future-cost warning the agency doesn't give.**

## Why it's more than "AI reads documents"

Claude reads the papers, but the value is the reasoning over a reconstructed **timeline** and the
cross-check against ground truth a seller cannot fake:

- **Odometer integrity** — regression, implausible jumps, stagnation
- **Service gaps · insurance lapses**
- **Ownership & identity vs the public record** (the moat — paper says 2 owners, the record shows 3)
- **Traffic violations** (over-speeding challans)
- **Hidden future costs** — big-ticket parts near end of life for the car's age/mileage
- **Price comparison** — what the car is really worth on the market

Output is a sourced, ranked list of flags — never a vague risk score — and a printable seller-question sheet.

## Architecture

Next.js (App Router) on Vercel — frontend + API routes, no database, one throwaway session.

- `lib/engine.ts` — deterministic timeline + 7 reconciliation rules (a verified TS port of
  `dataset/papertrail_test_data/reference/engine.py`, tested against all 13 scenarios).
- `lib/cost/costEngine.ts` — parts lifetime vs the car's real facts.
- `lib/scrapers/*` — Anakin public-record / challan / price adapters (live when app-ids are set,
  bundled mock fallback otherwise). Runs only in `/api/verify`; the 13-scenario oracle is untouched.
- Claude Opus vision extracts each document image to a strict JSON schema.

## Run

```bash
npm install
# .env: CLAUDE_API=<anthropic key>   ANAKIN_API=<anakin key>
npm run dev        # http://localhost:3000
npm test           # 50 tests incl. all 13 reference scenarios
```

Upload from `dataset/papertrail_test_data/scenarios/S13_multi_flag_demo/images/` for the full demo,
or open `/report` for the bundled hero report.

## Deploy

```bash
npx vercel --prod
# set CLAUDE_API and ANAKIN_API in the Vercel dashboard
```

To switch the moat from mock data to live scraping, set `ANAKIN_VAHAN_APP_ID`,
`ANAKIN_CHALLAN_APP_ID`, `ANAKIN_PRICE_APP_ID` to your Anakin app ids.

Built for Claude Opus Build Day.
