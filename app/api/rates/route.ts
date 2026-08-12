/**
 * /api/rates
 * ---------------------------------------------------------------------------
 * Live price table for the converter, in one flat map: USD per unit of every
 * asset in lib/converter/assets.ts.
 *
 * WHY A ROUTE HANDLER RATHER THAN CALLING COINGECKO FROM THE BROWSER
 * Three reasons, in order of how much they matter:
 *   1. Rate limits. CoinGecko's free tier meters per IP, and a client-side
 *      fetch spends one budget PER VISITOR. Here every visitor shares one
 *      upstream call per CACHE_TTL_MS, so a hundred people on the page cost the
 *      same as one.
 *   2. The optional API key stays server-side; a browser fetch would ship it.
 *   3. It gives somewhere to keep the last good payload, so a blip upstream
 *      degrades to a slightly stale quote instead of an empty converter.
 *
 * THE FIAT DERIVATION
 * CoinGecko prices coins in fiat, but has no direct "USD per EUR" endpoint on
 * this plan. The FX rate falls out of the coin prices for free: a coin quoted
 * at both $63,729 and €55,241 says one euro is 63729/55241 dollars. That ratio
 * is averaged across every coin that returned both legs rather than read off a
 * single coin, because the quotes are rounded and the coins are rounded by
 * different relative amounts — averaging keeps one cheap coin's coarse rounding
 * from setting the FX rate for the whole page.
 */

import { NextResponse } from "next/server";

import { CRYPTO_ASSETS, FIAT_ASSETS, type RatesPayload } from "@/lib/converter/assets";

/*
  Never prerendered and never served from the framework's data cache — the whole
  point of the endpoint is that it is current. Freshness is managed by the
  explicit cache below instead, which is what lets a failed upstream call fall
  back to the previous payload.
*/
export const dynamic = "force-dynamic";

/**
 * How long a fetched payload is served before the next request refreshes it.
 * 30s sits under CoinGecko's own update cadence for the free tier, so polling
 * faster would return the same numbers while spending the rate limit.
 */
const CACHE_TTL_MS = 30_000;

/** How long a cached payload may still be served if upstream is failing. */
const STALE_MAX_MS = 10 * 60_000;

const COINGECKO_URL = "https://api.coingecko.com/api/v3/simple/price";

interface CacheEntry {
  payload: RatesPayload;
  fetchedAt: number;
}

/*
  Module-level cache. This lives per server instance and does not survive a
  redeploy or a cold start — deliberately, because it is an optimisation, not a
  store. On a multi-instance deploy each instance keeps its own copy, which is
  fine: the worst case is one upstream call per instance per TTL.
*/
let cache: CacheEntry | null = null;
/** In-flight request, so a burst of callers triggers ONE upstream fetch. */
let inFlight: Promise<RatesPayload> | null = null;

type PriceResponse = Record<string, Record<string, number>>;

async function fetchRates(): Promise<RatesPayload> {
  const params = new URLSearchParams({
    ids: CRYPTO_ASSETS.map((a) => a.id).join(","),
    vs_currencies: FIAT_ASSETS.map((a) => a.id).join(","),
    precision: "full",
    // Costs nothing extra — same request, same rate-limit budget — and it is
    // what turns /rates from a list of numbers into a read on the market.
    include_24hr_change: "true",
  });

  const apiKey = process.env.COINGECKO_API_KEY;

  const res = await fetch(`${COINGECKO_URL}?${params}`, {
    headers: {
      accept: "application/json",
      ...(apiKey ? { "x-cg-demo-api-key": apiKey } : {}),
    },
    // Bypass Next's fetch cache; this module's own cache is the one in charge.
    cache: "no-store",
    signal: AbortSignal.timeout(8_000),
  });

  if (!res.ok) {
    throw new Error(`CoinGecko responded ${res.status}`);
  }

  const prices = (await res.json()) as PriceResponse;
  const usdPerUnit: Record<string, number> = {};
  const change24h: Record<string, number> = {};

  for (const asset of CRYPTO_ASSETS) {
    const usd = prices[asset.id]?.usd;
    // Absent or zero means the coin did not price this round. Leaving it out of
    // the map is what makes convert() return null for it rather than quoting 0.
    if (typeof usd === "number" && usd > 0) usdPerUnit[asset.code] = usd;

    const move = prices[asset.id]?.usd_24h_change;
    if (typeof move === "number" && Number.isFinite(move)) change24h[asset.code] = move;
  }

  for (const fiat of FIAT_ASSETS) {
    // USD is the unit the whole table is expressed in, so it is 1 by definition
    // — deriving it from coin ratios would just add rounding noise to the one
    // number that is exact.
    if (fiat.id === "usd") {
      usdPerUnit[fiat.code] = 1;
      // The table is denominated in USD, so USD cannot move against itself.
      change24h[fiat.code] = 0;
      continue;
    }

    let sum = 0;
    let n = 0;
    let moveSum = 0;
    let moveN = 0;
    for (const coin of CRYPTO_ASSETS) {
      const inUsd = prices[coin.id]?.usd;
      const inFiat = prices[coin.id]?.[fiat.id];
      if (typeof inUsd === "number" && typeof inFiat === "number" && inFiat > 0) {
        sum += inUsd / inFiat;
        n += 1;
      }

      /*
        The FX move falls out of the same coin the same way the rate itself
        does. If a coin rose 3% measured in dollars but only 2% measured in
        euros, the euro gained on the dollar by the ratio of those two — the
        coin's own volatility is in BOTH legs and divides out, which is what
        makes this readable at all despite being derived from crypto.

        Compounded, not subtracted: a naive `usdMove - fiatMove` is only
        accurate for small moves, and drifts exactly when a currency has done
        something worth reporting.
      */
      const usdMove = prices[coin.id]?.usd_24h_change;
      const fiatMove = prices[coin.id]?.[`${fiat.id}_24h_change`];
      if (
        typeof usdMove === "number" &&
        typeof fiatMove === "number" &&
        Number.isFinite(usdMove) &&
        Number.isFinite(fiatMove) &&
        fiatMove > -100
      ) {
        moveSum += ((1 + usdMove / 100) / (1 + fiatMove / 100) - 1) * 100;
        moveN += 1;
      }
    }
    if (n > 0) usdPerUnit[fiat.code] = sum / n;
    if (moveN > 0) change24h[fiat.code] = moveSum / moveN;
  }

  if (Object.keys(usdPerUnit).length < 2) {
    // A response that parsed but priced nothing is a failure, not an empty
    // result — throwing here lets the stale-cache fallback take over.
    throw new Error("CoinGecko returned no usable prices");
  }

  return { usdPerUnit, change24h, updatedAt: Date.now() };
}

export async function GET() {
  const now = Date.now();

  if (cache && now - cache.fetchedAt < CACHE_TTL_MS) {
    return jsonResponse(cache.payload);
  }

  try {
    // Coalesce: while one refresh is in flight every other caller awaits it
    // instead of opening its own connection to CoinGecko.
    inFlight ??= fetchRates().finally(() => {
      inFlight = null;
    });
    const payload = await inFlight;
    cache = { payload, fetchedAt: Date.now() };
    return jsonResponse(payload);
  } catch (error) {
    if (cache && now - cache.fetchedAt < STALE_MAX_MS) {
      // Upstream is down but the last good table is recent enough to be worth
      // more than an error. Flagged so the UI can say the quote is stale.
      return jsonResponse({ ...cache.payload, stale: true });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load rates" },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }
}

function jsonResponse(payload: RatesPayload) {
  return NextResponse.json(payload, {
    headers: {
      /*
        Matches CACHE_TTL_MS so any CDN in front of the app holds the response
        for exactly as long as this process would have. stale-while-revalidate
        lets an edge serve the previous copy during the refresh rather than
        blocking a visitor on it.
      */
      "cache-control": "public, s-maxage=30, stale-while-revalidate=120",
    },
  });
}
