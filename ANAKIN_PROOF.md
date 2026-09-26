# PaperTrail × Anakin — Live Web Scraping Proof

**Claim:** PaperTrail pulls real used-car market data live from **Cars24** and **Spinny**
via the **Anakin.io** web API — no hardcoded prices, no mock listings.

This document shows the receipts.

---

## 1. Credits are being consumed on the Anakin dashboard

Anakin bills one credit per API call. Across a demo session the balance visibly drops:

| Checkpoint | Credits available |
|---|---|
| Start of session | 5,300 |
| After a batch of price lookups | **5,275** |

**25 credits consumed** — one per live scrape/search. A mock would consume zero.

---

## 2. The exact API call PaperTrail makes

Server-side, from the `/api/verify` route (never the browser — that's why it doesn't
appear in the browser Network tab; it's a **server-to-server** call):

```http
POST https://api.anakin.io/v1/search
X-API-Key: ask_••••••••   (from .env, ANAKIN_API)
Content-Type: application/json

{ "prompt": "used 2018 Maruti Dzire price second hand car India
             site:cars24.com OR site:spinny.com OR site:cardekho.com" }
```

Code path: `lib/scrapers/anakin.ts` → `anakinSearch()` → `lib/scrapers/price.ts`
→ `fetchMarket()` → merged into the report in `lib/scrapers/enrich.ts`.

---

## 3. The live response — real Cars24 & Spinny listings

Captured live (`HTTP 200`, 993 ms, request id `search_d4e4efa890524f05285f0c8ab23f0b24`):

### Cars24 — real used listings, with km and price
- **Used 2018 Maruti Dzire VXI Manual** — *Petrol, Manual, 64,355 km*
  `https://www.cars24.com/buy-used-maruti-dzire-2018-cars-ghaziabad-11241198145`
- **Used 2018 Maruti Dzire VXI AMT Automatic** — *Petrol, Automatic, 54,300 km*
  `https://www.cars24.com/buy-used-maruti-dzire-2018-cars-bangalore-10213491138`
- **11,297 Used Maruti Cars in India** — *second-hand Maruti from ₹0.40 lakh*
  `https://www.cars24.com/buy-used-maruti-cars`

### Spinny — real used listings
- **Used Maruti Suzuki Dzire Cars in Pune** — *15 certified used Dzire, starting Rs. 2.56 Lakh*
  `https://www.spinny.com/used-dzire-cars-in-pune/s`

These are live URLs — open any of them and you land on the actual listing.

---

## 4. Three independent ways to verify it yourself

**A. Server log** — every call prints in the `npm run dev` terminal:
```
[anakin] LIVE /search <- 200 in 1103ms · 5 results · {"prompt":"used 2018 … Dzire ZDI …"}
```
`LIVE … 200` = it hit the live web via Anakin. (If the key were missing you'd see `SKIP`; on failure, `HTTP 4xx (fallback)`.)

**B. In the report UI** — the "Similar cars on the market" section shows a green
**● Live via Anakin** badge and clickable Cars24 / Spinny listings. The badge only
renders when `market.source === "live"`.

**C. The API response** — `POST /api/verify` returns JSON with:
```json
"market": { "low": 400000, "high": 817000, "count": 5, "source": "live" }
```
`"source": "live"` is set only when the real Anakin call returned data.

---

## 5. Why it isn't visible in the browser Network tab

The Anakin call is made by our **Next.js server** (`/api/verify` route), not the
browser. The browser only ever talks to our own `/api/extract` and `/api/verify`.
Server-side `fetch` never shows in DevTools → Network. This is correct architecture:
the Anakin key stays on the server and is never exposed to the client.

---

## 6. What is live vs. sample (full honesty)

| Data | Source |
|---|---|
| Document facts (RC, service, insurance) | **Claude Vision** on your uploaded photos |
| **Used-car market prices** | **LIVE via Anakin** (Cars24 / Spinny / CarDekho) |
| Public-record ownership & challans | Sample data **for the demo car only** — its registration (RTO `99`) is synthetic test data, so no real government record exists. A real registration is scraped the same way via Anakin's `/v1/url-scraper/scrape`. |

*Generated from a real Anakin API call during the build session.*
