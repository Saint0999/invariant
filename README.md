# Invariant

A live, read-only price reference for 16 crypto tokens and 20 world currencies. No account, no wallet connection, no setup — just a fast, trustworthy answer to "what is X worth in Y right now."

Crypto and fiat are modeled identically under the hood: every asset is priced in USD, so a conversion is always the same division. That means any-to-any conversion — crypto→fiat, fiat→crypto, crypto→crypto, fiat→fiat — works the same way through one interface.

## What it does

Two routes carry the whole product:

- **`/converter`** — pick two assets (crypto or fiat), type an amount, read the converted value at the live rate.
- **`/rates`** — the full board: every supported asset's live USD price and 24h change, with an expandable per-row price history chart (1d / 7d / 30d).

Both are read-only tools. Nothing here executes a trade, moves funds, or stores anything about the visitor.

## Stack

- [Next.js](https://nextjs.org/) 15 (App Router) + React 19, TypeScript
- Tailwind CSS 4
- Three.js / React Three Fiber + Lenis for the landing page's scene and scroll effects
- Prices sourced server-side from [CoinGecko](https://www.coingecko.com/en/api)'s free tier

## Getting started

```bash
npm install
npm run dev
```

The app runs at [http://localhost:3111](http://localhost:3111) (custom port, set in `package.json`).

Other scripts:

```bash
npm run build   # production build
npm start       # serve the production build
```

### Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `COINGECKO_API_KEY` | No | Optional CoinGecko demo API key, sent as `x-cg-demo-api-key`. The app works on CoinGecko's public free tier without one; adding a key raises the rate limit. |

Set it in a local `.env.local` file (not committed) if you have one.

## How rates work

All price data is fetched **server-side** in Next.js route handlers, never directly from the browser — so every visitor shares one upstream call instead of each spending their own CoinGecko rate-limit budget, and no key ever ships to the client.

### `GET /api/rates`

Returns a flat map of USD-per-unit for every asset, plus 24h % change:

```ts
{
  usdPerUnit: Record<string, number>,   // e.g. { BTC: 63729.12, EUR: 0.92, ... }
  change24h?: Record<string, number>,
  updatedAt: number,
  stale?: boolean
}
```

- Cached in-memory per server instance with a **30s TTL**; concurrent requests during a refresh are coalesced into one upstream call.
- If CoinGecko fails, the last good payload is served (up to **10 minutes** old) with `stale: true` rather than showing an empty converter.
- **Fiat rates are derived, not fetched directly.** CoinGecko has no direct FX endpoint on the free tier, so a fiat rate is backed out of coin prices quoted in both USD and that currency (e.g. BTC priced in both `$` and `€` implies a EUR/USD rate), averaged across all coins that returned both legs to smooth out per-coin rounding.

### `GET /api/history?code=BTC&base=USD&days=7`

Returns a price series for one asset denominated in another (`days` is one of `1`, `7`, `30`), used by the expandable chart on `/rates`.

- Cached per `(asset, base, days)` combination with a **5-minute TTL**, falling back to up to an **hour-old** series if upstream fails.
- Fiat history is derived the same way spot fiat rates are: divided out of Bitcoin's own USD series against Bitcoin priced in that currency, since CoinGecko has no direct FX history endpoint either.

### Adding a new asset

Add one entry to [`lib/converter/assets.ts`](lib/converter/assets.ts) — the shared list both API routes and the converter UI read from. `id` must match CoinGecko's coin id (crypto) or `vs_currency` code (fiat); `code` is the ticker Invariant displays.

## Project structure

```
app/
  api/rates/route.ts     Live USD-per-unit table (spot prices, 24h change)
  api/history/route.ts   Price history series for the /rates charts
  converter/page.tsx     /converter route
  rates/page.tsx         /rates route
  page.tsx               Landing page

components/
  converter/             Asset picker + conversion UI, live-rate polling hook
  rates/                 Rates board, expandable price chart, history hook
  landing/               Hero scene, scroll effects, marketing sections
  shell/                 Shared page chrome (ToolShell)
  ui/                    Small shared primitives (LiveBadge, Collapse, ...)

lib/
  converter/assets.ts    The one asset list + convert() — shared by API and UI
  converter/format.ts    Number/currency formatting helpers
  landing/demo.ts        Data for the landing page's live demo

public/                  Token logos (SVG)
```

## Product principles

These guide any change to this codebase (see [`PRODUCT.md`](PRODUCT.md) for the full product spec):

1. **Read-only, no setup** — every surface works with zero account, wallet, or signup. That's a stated part of the pitch, not a gap to fill later.
2. **One model, not two** — crypto and fiat stay the same shape (USD-denominated) everywhere; never add a code path that treats one as primary and the other as a special case.
3. **Never show a confident wrong number** — a missing or stale rate must be visibly stale or absent (`convert()` returns `null`), never silently substituted or defaulted to zero.
4. **Say only what the two routes do** — copy claims conversion and live rates, nothing about trading, payouts, or custody.

## License

Private project — no license granted for reuse.
