/**
 * /api/history?code=BTC&base=USD&days=7
 * ---------------------------------------------------------------------------
 * Price history for one asset, denominated in another, for the expanding chart
 * on /rates.
 *
 * THE FIAT PROBLEM
 * CoinGecko's history endpoint only knows about coins — there is no "EUR over
 * the last week" to ask for. But a coin quoted in both dollars and euros at the
 * same instants IS an FX series: divide the two and the coin cancels out. So a
 * fiat asset's history is derived from bitcoin's, exactly the way /api/rates
 * derives the spot FX rate from coin prices. Bitcoin specifically because it is
 * the most liquid and its series has the fewest gaps; the choice does not
 * affect the result beyond noise, since whatever bitcoin does appears in both
 * legs and divides out.
 *
 * COMPOSITION, AND WHY EVERYTHING IS CACHED IN USD
 * Every series is fetched and cached in USD terms, then divided pointwise into
 * the requested denomination. Two things fall out of that. The base's series is
 * fetched once and reused by every row the reader expands, rather than per
 * pair. And the USD leg of a derived FX series is *the same data* as the BTC
 * row's own series, so it is read from that same cache entry instead of being
 * fetched again — which is the difference between a cold fiat row costing two
 * upstream calls and costing one.
 *
 * RATE LIMITS ARE THE REAL CONSTRAINT HERE
 * The free tier meters per IP and this endpoint is far easier to trip than
 * /api/rates: it is one request per row opened, and history is not shared
 * across assets the way a single spot-price call is. Hence the long TTL, the
 * in-flight coalescing, and a stale fallback that will serve an hour-old series
 * rather than show the reader an empty chart.
 */

import { NextResponse } from "next/server";

import { ASSETS_BY_CODE, type Asset } from "@/lib/converter/assets";

export const dynamic = "force-dynamic";

/**
 * History moves far more slowly than spot: the newest point in a 7-day hourly
 * series is up to an hour old by construction. Five minutes keeps the chart
 * honest while making a reader who opens six rows cost almost nothing.
 */
const CACHE_TTL_MS = 5 * 60_000;
/** How old a cached series may be and still beat showing nothing. */
const STALE_MAX_MS = 60 * 60_000;

/** Windows the UI offers. Anything else is rejected rather than forwarded —
 *  this is a public endpoint and `days` lands in an upstream URL. */
const ALLOWED_DAYS = new Set([1, 7, 30]);

/**
 * The coin every derived FX series is built from. Taken from the asset table
 * rather than hard-coded as a string so that the USD leg fetched here is
 * literally the same cache entry as the BTC row's own series.
 */
const FX_REFERENCE = ASSETS_BY_CODE.BTC;

const COINGECKO_BASE = "https://api.coingecko.com/api/v3";

/** [timestamp ms, price] — CoinGecko's own shape, kept end to end. */
type Point = [number, number];

interface CacheEntry {
  series: Point[];
  fetchedAt: number;
}

const cache = new Map<string, CacheEntry>();
const inFlight = new Map<string, Promise<Point[]>>();

/** Fresh copy, or null. */
function fresh(key: string): Point[] | null {
  const hit = cache.get(key);
  return hit && Date.now() - hit.fetchedAt < CACHE_TTL_MS ? hit.series : null;
}

/** Any copy still worth serving when upstream has failed. */
function salvageable(key: string): Point[] | null {
  const hit = cache.get(key);
  return hit && Date.now() - hit.fetchedAt < STALE_MAX_MS ? hit.series : null;
}

/** Cache + coalesce around one upstream series. */
function cached(key: string, load: () => Promise<Point[]>): Promise<Point[]> {
  const hit = fresh(key);
  if (hit) return Promise.resolve(hit);

  const existing = inFlight.get(key);
  if (existing) return existing;

  const task = load()
    .then((series) => {
      cache.set(key, { series, fetchedAt: Date.now() });
      return series;
    })
    .finally(() => {
      inFlight.delete(key);
    });

  inFlight.set(key, task);
  return task;
}

async function coingecko(path: string): Promise<Record<string, unknown>> {
  const apiKey = process.env.COINGECKO_API_KEY;

  const res = await fetch(`${COINGECKO_BASE}${path}`, {
    headers: {
      accept: "application/json",
      ...(apiKey ? { "x-cg-demo-api-key": apiKey } : {}),
    },
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) throw new Error(`CoinGecko responded ${res.status}`);
  return (await res.json()) as Record<string, unknown>;
}

async function marketChart(id: string, vs: string, days: number): Promise<Point[]> {
  const data = await coingecko(
    `/coins/${encodeURIComponent(id)}/market_chart?vs_currency=${vs}&days=${days}`,
  );
  const prices = data.prices as Point[] | undefined;
  if (!Array.isArray(prices) || prices.length === 0) {
    throw new Error(`No history for ${id} in ${vs}`);
  }
  return prices;
}

/** Cache key for an asset's USD series. */
const usdKey = (code: string, days: number) => `${code}:${days}`;
/** Cache key for the reference coin priced in a fiat — the FX numerator. */
const fxKey = (fiatId: string, days: number) => `fx:${fiatId}:${days}`;

/** The asset's price in USD across the window. */
function usdSeries(asset: Asset, days: number): Promise<Point[]> {
  return cached(usdKey(asset.code, days), async () => {
    if (asset.kind === "crypto") return marketChart(asset.id, "usd", days);

    // USD in USD is 1 at every instant. It still carries the reference's
    // timestamps so it can be divided against any other series.
    if (asset.id === "usd") {
      const reference = await usdSeries(FX_REFERENCE, days);
      return reference.map(([t]): Point => [t, 1]);
    }

    /*
      Both legs are the same coin over the same window, so they arrive with
      matching cadence and — bar the final live point — identical timestamps.
      See `denominate` for why that last one is not assumed to line up.
    */
    const [inUsd, inFiat] = await Promise.all([
      usdSeries(FX_REFERENCE, days),
      cached(fxKey(asset.id, days), () => marketChart(FX_REFERENCE.id, asset.id, days)),
    ]);

    return denominate(inUsd, inFiat);
  });
}

/**
 * quote ÷ base, sampled at the quote's timestamps.
 *
 * Nearest-timestamp rather than index-for-index: the two series agree on every
 * point except the last, which is "now" and is stamped whenever each request
 * happened to be served. Pairing by index would divide the newest quote by a
 * base reading from a different moment — invisible on a 7-day chart, and
 * exactly the sort of thing that shows up as a phantom spike on the right-hand
 * edge of a 24-hour one.
 */
function denominate(quote: Point[], base: Point[]): Point[] {
  let cursor = 0;

  return quote.flatMap(([t, value]): Point[] => {
    // Both series ascend, so the cursor only ever moves forward.
    while (
      cursor < base.length - 1 &&
      Math.abs(base[cursor + 1][0] - t) <= Math.abs(base[cursor][0] - t)
    ) {
      cursor += 1;
    }

    const divisor = base[cursor][1];
    return divisor > 0 ? [[t, value / divisor]] : [];
  });
}

/** Summary stats the chart's header line is drawn from. */
function summarise(code: string, base: string, days: number, points: Point[], stale?: boolean) {
  const values = points.map(([, v]) => v);
  const first = values[0];
  const last = values[values.length - 1];

  return {
    code,
    base,
    days,
    points,
    low: Math.min(...values),
    high: Math.max(...values),
    /*
      The move across THIS WINDOW, which is not the 24h figure shown in the row
      unless days === 1 — the chart labels which window it is describing.
    */
    change: first > 0 ? ((last - first) / first) * 100 : 0,
    ...(stale ? { stale: true } : {}),
  };
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const asset = ASSETS_BY_CODE[params.get("code") ?? ""];
  const base = ASSETS_BY_CODE[params.get("base") ?? "USD"];
  const days = Number(params.get("days") ?? 7);

  if (!asset || !base) {
    return NextResponse.json({ error: "Unknown asset" }, { status: 400 });
  }
  if (!ALLOWED_DAYS.has(days)) {
    return NextResponse.json({ error: "Unsupported window" }, { status: 400 });
  }
  if (asset.code === base.code) {
    return NextResponse.json({ error: "An asset has no history against itself" }, { status: 400 });
  }

  const compose = (quote: Point[], denominator: Point[] | null) =>
    denominator ? denominate(quote, denominator) : quote;

  try {
    const [quote, denominator] = await Promise.all([
      usdSeries(asset, days),
      base.code === "USD" ? Promise.resolve(null) : usdSeries(base, days),
    ]);

    const points = compose(quote, denominator);
    if (points.length < 2) throw new Error("Not enough history to plot");

    return NextResponse.json(summarise(asset.code, base.code, days, points), {
      headers: { "cache-control": "public, s-maxage=300, stale-while-revalidate=600" },
    });
  } catch (error) {
    /*
      Upstream refused — a 429 on the free tier, most likely. Rebuild from
      whatever is still in the cache: an hour-old chart with a "may be stale"
      note beats an empty panel, and the reader's alternative is to sit there
      retrying into the same rate limit.
    */
    const quote = salvageable(usdKey(asset.code, days));
    const denominator = base.code === "USD" ? null : salvageable(usdKey(base.code, days));

    if (quote && (base.code === "USD" || denominator)) {
      const points = compose(quote, denominator);
      if (points.length >= 2) {
        return NextResponse.json(summarise(asset.code, base.code, days, points, true), {
          headers: { "cache-control": "no-store" },
        });
      }
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load history" },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }
}
