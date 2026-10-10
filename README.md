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
