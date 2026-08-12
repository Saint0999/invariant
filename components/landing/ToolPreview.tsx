"use client";

/**
 * ToolPreview.tsx
 * ---------------------------------------------------------------------------
 * Two cards under the currency cloud: a snippet of /converter beside a snippet
 * of /rates. Both run on the LIVE feed rather than on mocked numbers — the
 * whole claim of the page is that the rates are real, and a landing page
 * showing invented prices next to a link promising live ones undercuts it.
 *
 * ONE useRates FOR BOTH CARDS. The hook owns a 30s poll, so mounting it twice
 * would double the request rate for two views of the same table; the state is
 * lifted here and passed down instead.
 *
 * THE CARDS DEMO THEMSELVES. The converter types an amount in, swaps to the
 * next pair and re-quotes; the board flashes rows as if ticks were landing.
 * What is animated is only the INTERACTION — which pair is on screen, which row
 * just updated. Every number underneath is the live one, so the demo can run
 * indefinitely without ever showing a price that was made up.
 *
 * They are still previews, not the tools: nothing is editable, and the entire
 * card is the link to its route. A half-working converter here would be worse
 * than none — the reader types into it, finds the selectors inert, and the
 * broken thing is the first impression.
 */

import Link from "next/link";
import { useEffect, useMemo, useState, type FC, type ReactNode } from "react";
import { ArrowUpDown, TrendingUp } from "lucide-react";

import { AssetMark } from "@/components/converter/AssetSelect";
import { useRates, type RatesState } from "@/components/converter/useRates";
import { ASSETS_BY_CODE, CRYPTO_ASSETS, convert, type Asset } from "@/lib/converter/assets";
import { formatAmount, formatRate, parseAmount } from "@/lib/converter/format";

/**
 * The pairs the converter card cycles through. Same set as the tool's own quick
 * pairs, and chosen for the same reason: a crypto→fiat quote, a swap, and a
 * stablecoin cash-out say "any asset into any asset" faster than a sentence
 * about it does. The amounts are plausible ticket sizes rather than a flat 1,
 * which is what makes the typing read as somebody using the tool.
 */
const DEMO_PAIRS: Array<{ from: string; to: string; amount: string }> = [
  { from: "BTC", to: "USD", amount: "1" },
  { from: "ETH", to: "EUR", amount: "2.5" },
  { from: "SOL", to: "USDT", amount: "40" },
  { from: "USDC", to: "INR", amount: "500" },
];

/** Per keystroke, and how long the finished quote sits before the next pair. */
const TYPE_MS = 120;
const HOLD_MS = 2600;

/** How many rows the rates card shows before it stops being a snippet. */
const PREVIEW_ROWS = 5;

/** Rows are priced in USD here — the card has no base selector to change it. */
const PREVIEW_BASE = "USD";

/*
  Row flash order. Deliberately not 0,1,2,3,4: ticks arriving in strict top-to
  bottom order read as a progress bar sweeping the list, where an uneven order
  reads as independent updates landing.
*/
const FLASH_ORDER = [0, 2, 1, 4, 3];
const FLASH_EVERY_MS = 1400;
const FLASH_HOLD_MS = 520;

const ToolPreview: FC = () => {
  const rates = useRates();
  const reduced = usePrefersReducedMotion();

  return (
    <section
      id="tools"
      className="mx-auto mb-28 w-[min(1200px,calc(100%-2rem))] sm:mb-36"
    >
      <div className="flex flex-col items-center text-center">
        <p className="text-sm font-semibold tracking-tight text-white/55 sm:text-base">
          Both tools, already running
        </p>
        <h2 className="mt-3 text-balance bg-gradient-to-b from-white via-[#E8E8EC] to-[#9A9AA4] bg-clip-text pb-1 text-3xl font-bold leading-[1.1] tracking-[-0.03em] text-transparent sm:text-4xl">
          Live prices, no signup.
        </h2>
      </div>

      {/*
        items-stretch so the two cards share a height whatever their content
        measures — the rates list is the taller of the two, and a converter card
        floating short beside it reads as a layout bug rather than as a pair.
        Single column below md: side by side at 768px would put the rate rows at
        ~330px wide, where the price column starts colliding with the ticker.
      */}
      <div className="mt-10 grid items-stretch gap-4 md:grid-cols-2 sm:gap-6">
        <ConverterCard rates={rates} reduced={reduced} />
        <RatesCard rates={rates} reduced={reduced} />
      </div>
    </section>
  );
};

/* ==========================================================================
 * Motion preference
 * ========================================================================== */

/**
 * Both demos are JS timers, so the media query has to be read in script — a
 * `motion-reduce:` class can hide movement but cannot stop a setInterval, and
 * an animation running invisibly still re-renders the card every 120ms.
 *
 * Starts false and corrects in an effect: matchMedia does not exist during the
 * server render, and seeding it from anything else would make the first client
 * render disagree with the HTML.
 */
function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(query.matches);

    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  return reduced;
}

/* ==========================================================================
 * Shell
 * ========================================================================== */

interface CardProps {
  href: string;
  eyebrow: string;
  icon: ReactNode;
  title: string;
  /** Named for assistive tech, since the card has no CTA text to read out. */
  label: string;
  /** Feed state, so the card can show the same live/reconnecting dot as the tool. */
  rates: RatesState;
  children: ReactNode;
}

/**
 * The card shell — same glass recipe as the navbar and the two tools (light
 * fill, heavy blur, saturate to put back what the blur averages away) so these
 * read as pieces of the product rather than as marketing tiles.
 *
 * The whole card is the link and there is no button inside it, so the hover
 * affordance has to come from the surface itself: the border lifts, the fill
 * warms a shade, and the card rises 2px. `group` carries that down to the
 * children.
 */
const PreviewCard: FC<CardProps> = ({
  href,
  eyebrow,
  icon,
  title,
  label,
  rates,
  children,
}) => (
  <Link
    href={href}
    aria-label={label}
    className="group flex flex-col rounded-3xl border border-white/[0.08] border-b-white/10 bg-[#1D1D21]/40 p-5 shadow-[0_8px_32px_-12px_rgba(0,0,0,0.7)] backdrop-blur-xl backdrop-saturate-150 transition-[transform,border-color,background-color] duration-300 hover:-translate-y-0.5 hover:border-white/20 hover:bg-[#1D1D21]/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 motion-reduce:transition-none motion-reduce:hover:translate-y-0 sm:p-6"
  >
    <div className="flex items-center justify-between gap-3">
      <span className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/45">
        {icon}
        {eyebrow}
      </span>
      <FeedDot rates={rates} />
    </div>

    <h3 className="mt-3 text-lg font-semibold tracking-tight text-white sm:text-xl">
      {title}
    </h3>

    {/* flex-1 so both bodies fill their card and the two stay the same height
        even though the board lists five rows against the converter's two. */}
    <div className="mt-5 flex flex-1 flex-col justify-center">{children}</div>
  </Link>
);

/** The same freshness marker the tools carry, minus the refresh button — there
 *  is nothing to refresh into on a preview. */
const FeedDot: FC<{ rates: RatesState }> = ({ rates }) => {
  const { error, stale, refreshing, loading } = rates;

  return (
    <span className="inline-flex items-center gap-2 text-[11px] text-white/35">
      <span
        className={
          "h-1.5 w-1.5 rounded-full " +
          (error || stale
            ? "bg-amber-300/80"
            : refreshing || loading
              ? "animate-pulse bg-white/80"
              : "bg-emerald-300/70")
        }
        aria-hidden
      />
      {error ? "Reconnecting" : loading ? "Connecting" : "Live"}
    </span>
  );
};

/* ==========================================================================
 * Converter card
 * ========================================================================== */

/**
 * Runs the typing demo: types the current pair's amount a character at a time,
 * holds the finished quote, then advances.
 *
 * Returns the typed TEXT rather than a number, and the card converts from it —
 * so the receive side lands on 0.5 BTC on the way to 0.55, exactly as it does
 * when a person is typing into the real field.
 */
function useTypingDemo(reduced: boolean): { index: number; typed: string } {
  const [index, setIndex] = useState(0);
  const [typed, setTyped] = useState(DEMO_PAIRS[0].amount);

  useEffect(() => {
    if (reduced) {
      setIndex(0);
      setTyped(DEMO_PAIRS[0].amount);
      return;
    }

    const target = DEMO_PAIRS[index].amount;
    setTyped("");

    let count = 0;
    let advance: ReturnType<typeof setTimeout> | undefined;

    const typer = setInterval(() => {
      count += 1;
      setTyped(target.slice(0, count));

      if (count >= target.length) {
        clearInterval(typer);
        advance = setTimeout(
          () => setIndex((i) => (i + 1) % DEMO_PAIRS.length),
          HOLD_MS,
        );
      }
    }, TYPE_MS);

    return () => {
      clearInterval(typer);
      if (advance) clearTimeout(advance);
    };
  }, [index, reduced]);

  return { index, typed };
}

const ConverterCard: FC<{ rates: RatesState; reduced: boolean }> = ({ rates, reduced }) => {
  const { index, typed } = useTypingDemo(reduced);
  const pair = DEMO_PAIRS[index];

  const from = ASSETS_BY_CODE[pair.from];
  const to = ASSETS_BY_CODE[pair.to];

  const amount = parseAmount(typed);
  const result = Number.isNaN(amount)
    ? null
    : convert(amount, pair.from, pair.to, rates.usdPerUnit);
  const unitRate = convert(1, pair.from, pair.to, rates.usdPerUnit);

  return (
    <PreviewCard
      href="/converter"
      eyebrow="Converter"
      icon={<ArrowUpDown className="h-3.5 w-3.5" />}
      title="Any token into any currency."
      label="Open the converter"
      rates={rates}
    >
      <div className="relative">
        <QuoteRow
          label="You send"
          asset={from}
          /* The raw typed text, not a formatted amount: formatting it would
             rewrite the digits mid-keystroke, and "2.5" would render as "2"
             for as long as the decimal point sat alone at the end. */
          value={typed}
          caret={!reduced}
        />

        {/*
          The swap chip from the real tool. Pulled out of the flow with -my-3 so
          it straddles the seam between the two rows exactly as it does on
          /converter — that overlap is what makes the pair read as one control
          instead of two stacked boxes.

          A half turn per pair, accumulated rather than toggled between 0 and
          180, so it always rotates the same way instead of winding back on
          alternate cycles.
        */}
        <div className="relative z-10 -my-3 flex justify-center" aria-hidden>
          <span
            className="grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-[#26262B] text-white/70 shadow-[0_8px_24px_-8px_rgba(0,0,0,0.9)] transition-transform duration-500 ease-in-out motion-reduce:transition-none"
            style={{ transform: `rotate(${index * 180}deg)` }}
          >
            <ArrowUpDown className="h-4 w-4" />
          </span>
        </div>

        <QuoteRow
          label="You receive"
          asset={to}
          value={result === null ? null : formatAmount(result, to)}
          emphasis
        />
      </div>

      <p className="mt-4 text-xs leading-relaxed text-white/40">
        {unitRate === null ? (
          "Fetching the live mid-market rate…"
        ) : (
          <>
            1 {from.code} ={" "}
            <span className="tabular-nums text-white/60">
              {to.kind === "fiat" && to.symbol ? to.symbol : ""}
              {formatRate(unitRate)}
            </span>{" "}
            {to.code} · mid-market, before network and payout fees.
          </>
        )}
      </p>
    </PreviewCard>
  );
};

/** One side of the quote. `value` is null while the rate is still missing. */
const QuoteRow: FC<{
  label: string;
  asset: Asset;
  value: string | null;
  emphasis?: boolean;
  /** Draws the blinking cursor after the value, on the side being typed into. */
  caret?: boolean;
}> = ({ label, asset, value, emphasis = false, caret = false }) => (
  <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] px-4 py-3.5">
    <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/35">
      {label}
    </span>

    {/* Fixed height: the receive side swaps between a skeleton bar and a line
        of 2xl type, and letting the row size to whichever is showing makes the
        card jump every time a quote lands. */}
    <div className="mt-2 flex h-10 items-center gap-3">
      {value === null ? (
        <span className="h-7 w-32 animate-pulse rounded bg-white/[0.06]" />
      ) : (
        <span
          className={
            "flex min-w-0 flex-1 items-center text-2xl font-semibold tracking-tight tabular-nums " +
            (emphasis ? "text-white" : "text-white/85")
          }
        >
          <span className="truncate">
            {asset.kind === "fiat" && asset.symbol ? asset.symbol : ""}
            {value}
          </span>
          {caret && (
            <span
              className="ml-0.5 inline-block h-6 w-px shrink-0 animate-caret-blink bg-white/70 motion-reduce:hidden"
              aria-hidden
            />
          )}
        </span>
      )}

      {/* Reads like the tool's asset selector, and is deliberately not one —
          no chevron, because nothing here opens. Keyed by code so a pair change
          replays the fade rather than swapping the mark in place. */}
      <span
        key={asset.code}
        className="ml-auto inline-flex shrink-0 animate-rise-in items-center gap-2 rounded-full border border-white/[0.07] bg-white/[0.05] py-1.5 pl-1.5 pr-3"
      >
        <AssetMark asset={asset} className="h-6 w-6" />
        <span className="text-sm font-semibold tracking-tight text-white">{asset.code}</span>
      </span>
    </div>
  </div>
);

/* ==========================================================================
 * Rates card
 * ========================================================================== */

/** Index of the row currently flashing, or null between ticks. */
function useTickingRows(reduced: boolean): number | null {
  const [flash, setFlash] = useState<number | null>(null);

  useEffect(() => {
    if (reduced) return;

    let step = 0;
    let clear: ReturnType<typeof setTimeout> | undefined;

    const timer = setInterval(() => {
      setFlash(FLASH_ORDER[step % FLASH_ORDER.length]);
      step += 1;
      clear = setTimeout(() => setFlash(null), FLASH_HOLD_MS);
    }, FLASH_EVERY_MS);

    return () => {
      clearInterval(timer);
      if (clear) clearTimeout(clear);
    };
  }, [reduced]);

  return flash;
}

const RatesCard: FC<{ rates: RatesState; reduced: boolean }> = ({ rates, reduced }) => {
  const { usdPerUnit, change24h } = rates;
  const flash = useTickingRows(reduced);

  /* The top few by the market-cap order assets.ts already carries — a preview
     that re-sorted by 24h move would show a different five every poll, and the
     card would reshuffle under the reader for no informational gain. */
  const rows = useMemo(
    () =>
      CRYPTO_ASSETS.slice(0, PREVIEW_ROWS).map((asset) => ({
        asset,
        price: convert(1, asset.code, PREVIEW_BASE, usdPerUnit),
        change: change24h[asset.code] ?? null,
      })),
    [usdPerUnit, change24h],
  );

  const base = ASSETS_BY_CODE[PREVIEW_BASE];

  return (
    <PreviewCard
      href="/rates"
      eyebrow="Live rates"
      icon={<TrendingUp className="h-3.5 w-3.5" />}
      title="Every rate on one board."
      label="See the full rates board"
      rates={rates}
    >
      <ul className="-my-1.5">
        {rows.map(({ asset, price, change }, i) => {
          const lit = flash === i;

          return (
            <li
              key={asset.code}
              className={
                /* -mx-2 px-2 so the flash bleeds a little past the text column
                   and reads as the ROW updating rather than as a highlight
                   drawn tightly around the labels. */
                "-mx-2 flex items-center gap-3 rounded-xl border-b border-white/[0.05] px-2 py-2.5 transition-colors duration-500 last:border-b-0 motion-reduce:transition-none " +
                (lit ? "bg-white/[0.05]" : "bg-transparent")
              }
            >
              <AssetMark asset={asset} className="h-7 w-7" />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold tracking-tight text-white">
                  {asset.code}
                </p>
                <p className="truncate text-xs text-white/40">{asset.name}</p>
              </div>

              <div className="ml-auto text-right">
                {price === null ? (
                  <span className="block h-3 w-20 animate-pulse rounded bg-white/[0.06]" />
                ) : (
                  <p
                    /*
                      The tick itself: the price brightens and lifts a hair as
                      the row lights, then settles. Deliberately does NOT change
                      the number — inventing movement to animate would be
                      showing a price nobody quoted, on a page whose whole claim
                      is that these are real.
                    */
                    className={
                      "text-sm font-semibold tabular-nums transition-[color,transform] duration-500 motion-reduce:transition-none " +
                      (lit ? "-translate-y-px text-white" : "text-white/85")
                    }
                  >
                    {base.symbol}
                    {formatRate(price)}
                  </p>
                )}
                <Change value={change} />
              </div>
            </li>
          );
        })}
      </ul>
    </PreviewCard>
  );
};

/**
 * The 24h move, same treatment as the board: muted green and red, and anything
 * that rounds away renders flat rather than as a signed zero — without that
 * every stablecoin shows a "-0.00%" that reads as a loss.
 */
const Change: FC<{ value: number | null }> = ({ value }) => {
  if (value === null) return <span className="text-[11px] text-white/25">—</span>;

  const flat = Math.abs(value) < 0.005;
  const up = value >= 0;

  return (
    <span
      className={
        "text-[11px] font-semibold tabular-nums " +
        (flat ? "text-white/40" : up ? "text-emerald-300/85" : "text-rose-300/85")
      }
    >
      {flat ? "0.00" : `${up ? "+" : ""}${value.toFixed(2)}`}%
    </span>
  );
};

export default ToolPreview;
