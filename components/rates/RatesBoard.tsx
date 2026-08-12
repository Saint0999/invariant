"use client";

/**
 * RatesBoard.tsx
 * ---------------------------------------------------------------------------
 * The /rates board: every supported asset, live, priced in whichever currency
 * the reader picks.
 *
 * PRICED IN ANY ASSET, NOT JUST FIAT. The base selector accepts crypto too, so
 * "everything in BTC" is one tap. That falls out of the rate model for free —
 * every asset carries a USD price, so a row is `usdPerUnit[row] /
 * usdPerUnit[base]` regardless of what either side is — and refusing it would
 * have meant writing code specifically to take the feature away.
 *
 * Shares the feed with the converter through useRates: same endpoint, same 30s
 * poll, same suspend-while-hidden behaviour. Two tabs open on the two routes
 * cost the server the same as one.
 */

import { useEffect, useMemo, useState, type FC } from "react";
import { ArrowUpDown, RefreshCw, Search, TrendingUp } from "lucide-react";

import AssetSelect, { AssetMark } from "@/components/converter/AssetSelect";
import { useRates } from "@/components/converter/useRates";
import { ASSETS, ASSETS_BY_CODE, convert, type Asset } from "@/lib/converter/assets";
import { formatAge, formatRate } from "@/lib/converter/format";

type Filter = "all" | "crypto" | "fiat";
type SortKey = "default" | "price" | "change";

const FILTERS: Array<{ key: Filter; label: string }> = [
  { key: "all", label: "All" },
  { key: "crypto", label: "Crypto" },
  { key: "fiat", label: "Currencies" },
];

interface Row {
  asset: Asset;
  /** Price of one unit of `asset` in the base currency. Null if unpriced. */
  price: number | null;
  /** 24h move against the base, percent. Null when either leg is missing. */
  change: number | null;
}

const RatesBoard: FC = () => {
  const { usdPerUnit, change24h, updatedAt, loading, refreshing, error, stale, refresh } =
    useRates();

  const [base, setBase] = useState("USD");
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<SortKey>("default");
  const [query, setQuery] = useState("");

  const baseAsset = ASSETS_BY_CODE[base];

  const rows = useMemo<Row[]>(() => {
    const q = query.trim().toLowerCase();

    return ASSETS
      // The base priced in itself is always exactly 1. It is not a rate, it is
      // a tautology, and it would sort to the top of the change column.
      .filter((asset) => asset.code !== base)
      .filter((asset) => (filter === "all" ? true : asset.kind === filter))
      .filter(
        (asset) =>
          !q || asset.code.toLowerCase().includes(q) || asset.name.toLowerCase().includes(q),
      )
      .map((asset) => {
        const price = convert(1, asset.code, base, usdPerUnit);

        /*
          Both moves are quoted against USD, so against a non-USD base the
          asset's move has to be re-expressed relative to the base's own.
          Compounded rather than subtracted — the difference matters exactly
          when one of the two has moved enough to be worth reading.
        */
        const assetMove = change24h?.[asset.code];
        const baseMove = change24h?.[base];
        const change =
          typeof assetMove === "number" && typeof baseMove === "number" && baseMove > -100
            ? ((1 + assetMove / 100) / (1 + baseMove / 100) - 1) * 100
            : null;

        return { asset, price, change };
      })
      .sort((a, b) => {
        // Unpriced rows sink in every sort — a missing rate is not a small one.
        if (sort === "price") return (b.price ?? -Infinity) - (a.price ?? -Infinity);
        if (sort === "change") return (b.change ?? -Infinity) - (a.change ?? -Infinity);
        return 0; // assets.ts order: crypto by rough market cap, then fiat
      });
  }, [base, filter, query, sort, usdPerUnit, change24h]);

  /* Ticks the "updated 12s ago" label. Derived from a clock, so nothing else
     would re-render it and it would sit frozen between polls. */
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const hasRates = Object.keys(usdPerUnit).length > 0;

  return (
    <div className="mx-auto w-[min(1000px,calc(100%-2rem))]">
      {/* ---- Heading -------------------------------------------------- */}
      <div className="flex flex-col items-center text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/50">
          <TrendingUp className="h-3.5 w-3.5" />
          Live market rates
        </span>

        <h1 className="mt-5 text-balance bg-gradient-to-b from-white via-[#E8E8EC] to-[#9A9AA4] bg-clip-text pb-1 text-4xl font-bold leading-[1.05] tracking-[-0.035em] text-transparent sm:text-5xl">
          Every rate on one board.
        </h1>
        <p className="mt-4 max-w-lg text-pretty text-sm leading-relaxed text-white/50 sm:text-base">
          {ASSETS.length} assets — {ASSETS.filter((a) => a.kind === "crypto").length} tokens and{" "}
          {ASSETS.filter((a) => a.kind === "fiat").length} world currencies — priced in whatever
          you pick, refreshed every 30 seconds.
        </p>
      </div>

      {/* ---- Controls -------------------------------------------------- */}
      <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-3.5 py-2.5 sm:flex-1">
          <Search className="h-4 w-4 shrink-0 text-white/35" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search assets"
            aria-label="Search assets"
            autoComplete="off"
            spellCheck={false}
            className="w-full bg-transparent text-sm text-white placeholder:text-white/30 focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/35">
            Priced in
          </span>
          <div className="w-44">
            <AssetSelect value={base} onChange={setBase} label="Base currency" />
          </div>
        </div>
      </div>

      {/* ---- Filter tabs + freshness ----------------------------------- */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <div className="flex items-center gap-1.5">
          {FILTERS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              aria-pressed={filter === key}
              className={
                "rounded-full border px-3.5 py-1.5 text-xs font-semibold tracking-tight transition-colors " +
                (filter === key
                  ? "border-white/30 bg-white/[0.12] text-white"
                  : "border-white/10 bg-white/[0.04] text-white/50 hover:border-white/25 hover:text-white")
              }
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <span className="flex items-center gap-2 text-xs text-white/40">
            <span
              className={
                "h-1.5 w-1.5 rounded-full " +
                (error || stale
                  ? "bg-amber-300/80"
                  : refreshing
                    ? "animate-pulse bg-white/80"
                    : "bg-emerald-300/70")
              }
              aria-hidden
            />
            {error
              ? "Reconnecting"
              : updatedAt
                ? `Updated ${formatAge(now - updatedAt)}`
                : "Connecting"}
          </span>

          <button
            type="button"
            onClick={refresh}
            aria-label="Refresh rates"
            className="grid h-8 w-8 place-items-center rounded-full border border-white/10 bg-white/[0.06] text-white/60 transition-colors hover:border-white/25 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
          >
            <RefreshCw className={"h-3.5 w-3.5 " + (refreshing ? "animate-spin" : "")} />
          </button>
        </div>
      </div>

      {/* ---- The board -------------------------------------------------- */}
      <div className="mt-4 overflow-hidden rounded-3xl border-b border-white/10 bg-[#1D1D21]/40 shadow-[0_8px_32px_-12px_rgba(0,0,0,0.7)] backdrop-blur-xl backdrop-saturate-150">
        {/* Column head. Price and 24h are sort toggles; the asset column is not,
            because assets.ts order is itself meaningful (rough market cap). */}
        <div className="grid grid-cols-[1fr_auto] items-center gap-4 border-b border-white/[0.08] px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/35 sm:grid-cols-[1fr_10rem_7rem] sm:px-6">
          <span>Asset</span>
          <SortHeader
            label={`Price (${base})`}
            active={sort === "price"}
            onClick={() => setSort((s) => (s === "price" ? "default" : "price"))}
            className="text-right"
          />
          <SortHeader
            label="24h"
            active={sort === "change"}
            onClick={() => setSort((s) => (s === "change" ? "default" : "change"))}
            className="hidden text-right sm:block"
          />
        </div>

        {loading && !hasRates ? (
          <SkeletonRows />
        ) : rows.length === 0 ? (
          <p className="px-6 py-16 text-center text-sm text-white/40">
            Nothing matches “{query}”.
          </p>
        ) : (
          <ul>
            {rows.map(({ asset, price, change }) => (
              <li
                key={asset.code}
                className="grid grid-cols-[1fr_auto] items-center gap-4 border-b border-white/[0.05] px-4 py-3.5 transition-colors last:border-b-0 hover:bg-white/[0.03] sm:grid-cols-[1fr_10rem_7rem] sm:px-6"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <AssetMark asset={asset} className="h-8 w-8" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold tracking-tight text-white">
                      {asset.code}
                    </p>
                    <p className="truncate text-xs text-white/40">{asset.name}</p>
                  </div>
                </div>

                <div className="text-right">
                  <p className="text-sm font-semibold tabular-nums text-white sm:text-[0.95rem]">
                    {price === null ? (
                      <span className="text-white/30">—</span>
                    ) : (
                      <>
                        {baseAsset.symbol && baseAsset.kind === "fiat" ? baseAsset.symbol : ""}
                        {formatRate(price)}
                      </>
                    )}
                  </p>
                  {/* The 24h column collapses into this cell on phones rather
                      than being dropped — it is half the reason to open the
                      page, and a third column does not fit at 375px. */}
                  <p className="sm:hidden">
                    <Change value={change} compact />
                  </p>
                </div>

                <p className="hidden text-right sm:block">
                  <Change value={change} />
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>

      {(error || stale) && (
        <p className="mt-3 text-center text-xs text-amber-200/70">
          {error
            ? "Live feed unreachable — showing the last rates we received."
            : "The rate provider is slow to respond; these rates may be a few minutes old."}
        </p>
      )}

      <div className="mt-8 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-center text-xs leading-relaxed text-white/30">
        <span>
          Indicative mid-market prices from CoinGecko, excluding network and payout fees.
        </span>
        <a
          href="/converter"
          className="inline-flex items-center gap-1 font-semibold text-white/50 transition-colors hover:text-white"
        >
          <ArrowUpDown className="h-3 w-3" />
          Convert an amount
        </a>
      </div>
    </div>
  );
};

/* ==========================================================================
 * Bits
 * ========================================================================== */

const SortHeader: FC<{
  label: string;
  active: boolean;
  onClick: () => void;
  className?: string;
}> = ({ label, active, onClick, className = "" }) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={active}
    className={
      "text-[10px] font-semibold uppercase tracking-[0.16em] transition-colors hover:text-white " +
      (active ? "text-white" : "text-white/35") +
      " " +
      className
    }
  >
    {label}
    {active ? " ↓" : ""}
  </button>
);

/**
 * The 24h move. Green and red are the one place this page breaks its own
 * monochrome rule, and they earn it: direction is the fastest thing to read on
 * a board like this, and a neutral treatment would make every row look alike.
 * Muted shades rather than saturated ones so they still sit in the charcoal.
 */
const Change: FC<{ value: number | null; compact?: boolean }> = ({ value, compact = false }) => {
  if (value === null) return <span className="text-xs text-white/25">—</span>;

  /*
    Anything that rounds away is flat, and must render as flat. Without this a
    move of -0.0004% prints as "-0.00%" — a signed zero, which reads as either a
    rounding bug or a loss, and every stablecoin on the board shows one.
  */
  const flat = Math.abs(value) < 0.005;
  const up = value >= 0;

  return (
    <span
      className={
        "font-semibold tabular-nums " +
        (compact ? "text-[11px] " : "text-sm ") +
        (flat ? "text-white/40" : up ? "text-emerald-300/85" : "text-rose-300/85")
      }
    >
      {flat ? "0.00" : `${up ? "+" : ""}${value.toFixed(2)}`}%
    </span>
  );
};

/** Placeholder rows during the first load, so the board does not pop in. */
const SkeletonRows: FC = () => (
  <ul aria-hidden>
    {Array.from({ length: 8 }, (_, i) => (
      <li
        key={i}
        className="grid grid-cols-[1fr_auto] items-center gap-4 border-b border-white/[0.05] px-4 py-3.5 last:border-b-0 sm:grid-cols-[1fr_10rem_7rem] sm:px-6"
      >
        <div className="flex items-center gap-3">
          <span className="h-8 w-8 animate-pulse rounded-full bg-white/[0.06]" />
          <div className="space-y-1.5">
            <span className="block h-3 w-14 animate-pulse rounded bg-white/[0.06]" />
            <span className="block h-2.5 w-20 animate-pulse rounded bg-white/[0.04]" />
          </div>
        </div>
        <span className="ml-auto block h-3 w-20 animate-pulse rounded bg-white/[0.06]" />
        <span className="ml-auto hidden h-3 w-12 animate-pulse rounded bg-white/[0.06] sm:block" />
      </li>
    ))}
  </ul>
);

export default RatesBoard;
