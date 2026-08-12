"use client";

/**
 * GraphDemo.tsx
 * ---------------------------------------------------------------------------
 * The chart that lives inside an expanded /rates row, shown on the landing page
 * before the reader has to go looking for it. Opening a row is a gesture nobody
 * performs on a page they have not been sold on yet, so the feature was
 * effectively invisible from here.
 *
 * IT IS THE REAL PriceChart, not a picture of one. The component takes its
 * points as a prop and has no idea where they came from, so a demo series
 * renders through exactly the same path as a live one — including the hover
 * scrub, which is the part worth showing and the part a screenshot cannot
 * convey. The series themselves are fixed samples from lib/landing/demo.ts.
 *
 * The controls are REAL, unlike the ones on the preview cards above. Everything
 * they switch between is already in the bundle, so they can work without a
 * request, and a chart the reader can poke at makes the case better than one
 * that only plays at them. The auto-cycle exists for the reader who does not
 * poke, and holds still while the pointer is on the card so it never moves
 * under someone who is.
 */

import Link from "next/link";
import { useEffect, useMemo, useState, type FC } from "react";
import { ArrowRight, LineChart } from "lucide-react";

import { AssetMark } from "@/components/converter/AssetSelect";
import PriceChart from "@/components/rates/PriceChart";
import { ASSETS_BY_CODE, convert } from "@/lib/converter/assets";
import { formatRate } from "@/lib/converter/format";
import { DEMO_USD_PER_UNIT, demoSeries } from "@/lib/landing/demo";

/** Assets the demo offers. Three, not the board's full list: this is a sample
 *  of the feature, and a row of sixteen chips is a control panel. */
const DEMO_ASSETS = ["BTC", "ETH", "SOL"] as const;
type DemoAsset = (typeof DEMO_ASSETS)[number];

/** Windows, matching what an expanded row on /rates offers. */
const WINDOWS = [
  { days: 1, label: "24h", points: 48 },
  { days: 7, label: "7d", points: 84 },
  { days: 30, label: "30d", points: 90 },
] as const;

const DAY_MS = 86_400_000;

/**
 * Move across each window, and how far the series wanders off that trend —
 * `amplitude` is the widest excursion as a fraction of price, which is what
 * gives each asset its own texture. Hand-set rather than derived: a set that is
 * 30d-up / 7d-down / 24h-up says more about the product than three curves all
 * leaning the same way, and it exercises both the green and the red treatment.
 *
 * Amplitude scales with the window: a day's chart that wanders as far as a
 * month's is a day that had a month's worth of news in it.
 */
const SHAPES: Record<
  DemoAsset,
  { amplitude: Record<number, number>; change: Record<number, number> }
> = {
  BTC: {
    amplitude: { 1: 0.006, 7: 0.022, 30: 0.05 },
    change: { 1: -0.14, 7: 4.82, 30: 11.4 },
  },
  ETH: {
    amplitude: { 1: 0.009, 7: 0.031, 30: 0.068 },
    change: { 1: 1.25, 7: -2.68, 30: 6.15 },
  },
  SOL: {
    amplitude: { 1: 0.014, 7: 0.046, 30: 0.098 },
    change: { 1: 2.41, 7: 9.34, 30: -4.72 },
  },
};

/** Seeds per asset, so each one's noise is its own and stays put across loads. */
const SEEDS: Record<DemoAsset, number> = { BTC: 20260812, ETH: 71145, SOL: 90210 };

/**
 * How long each asset holds before the demo moves on, whenever the cycle is
 * running.
 *
 * Paced as a demo, not as something to read: the point is that the section is
 * alive and that a chart exists per asset. Anyone who wants to actually read
 * one is hovering it, and the cycle is paused for as long as they are.
 */
const CYCLE_MS = 3000;

const BASE = "USD";

const GraphDemo: FC = () => {
  const [asset, setAsset] = useState<DemoAsset>("BTC");
  const [days, setDays] = useState<number>(7);
  /**
   * True while the pointer is over the card or something inside it holds focus.
   * The cycle pauses for exactly that long and picks up again on the way out.
   *
   * A HOVER PAUSE RATHER THAN A PERMANENT STOP. An earlier pass ended the cycle
   * for good on the first click, on the theory that a click means the reader
   * has taken over — but they take over for a few seconds, and the section then
   * sits frozen for the rest of the visit on whatever they last looked at. The
   * cursor already says whether someone is engaged, and it says so both when
   * they arrive and when they leave.
   */
  const [engaged, setEngaged] = useState(false);

  /*
    One timestamp for the whole section, read once on mount. The chart only
    surfaces these on hover, so nothing timestamped is in the server HTML and
    Date.now() differing between the two renders cannot desync hydration.
  */
  const [endsAt] = useState(() => Date.now());

  /*
    Torn down and rebuilt when `engaged` flips, so leaving the card starts a
    fresh CYCLE_MS rather than resuming into whatever was left of the tick that
    was running when the reader arrived — which could be a few milliseconds, and
    would swap the chart out from under them as they pull away.
  */
  useEffect(() => {
    if (engaged) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const timer = setInterval(() => {
      setAsset((current) => {
        const next = (DEMO_ASSETS.indexOf(current) + 1) % DEMO_ASSETS.length;
        return DEMO_ASSETS[next];
      });
    }, CYCLE_MS);

    return () => clearInterval(timer);
  }, [engaged]);

  const price = convert(1, asset, BASE, DEMO_USD_PER_UNIT) ?? 0;
  const change = SHAPES[asset].change[days];

  const points = useMemo(
    () =>
      demoSeries(
        // Seeded per asset AND per window: sharing one seed across the three
        // windows draws the same wiggle at three scales, and switching between
        // them then reads as a zoom rather than as a different series.
        SEEDS[asset] + days,
        price,
        change,
        SHAPES[asset].amplitude[days],
        WINDOWS.find((w) => w.days === days)?.points ?? 60,
        days * DAY_MS,
        endsAt,
      ),
    [asset, days, price, change, endsAt],
  );

  const baseAsset = ASSETS_BY_CODE[BASE];

  return (
    <section
      id="charts"
      className="mx-auto mb-28 w-[min(1200px,calc(100%-2rem))] sm:mb-36"
    >
      <div className="flex flex-col items-center text-center">
        <p className="text-sm font-semibold tracking-tight text-white/55 sm:text-base">
          And the history behind every one
        </p>
        <h2 className="mt-3 text-balance bg-gradient-to-b from-white via-[#E8E8EC] to-[#9A9AA4] bg-clip-text pb-1 text-3xl font-bold leading-[1.1] tracking-[-0.03em] text-transparent sm:text-4xl">
          Open a row, get the chart.
        </h2>
      </div>

      {/*
        Same glass recipe as the cards above and as the board itself.

        Pointer events rather than mouse ones, so a stylus and a touch counts
        the same as a cursor. onFocus/onBlur cover the keyboard: React's bubble,
        so focus landing on any chip inside pauses the cycle for a reader who
        never moves a pointer at all.
      */}
      <div
        onPointerEnter={() => setEngaged(true)}
        onPointerLeave={() => setEngaged(false)}
        onFocus={() => setEngaged(true)}
        onBlur={() => setEngaged(false)}
        className="mt-10 rounded-3xl border border-white/[0.08] border-b-white/10 bg-[#1D1D21]/40 p-5 shadow-[0_8px_32px_-12px_rgba(0,0,0,0.7)] backdrop-blur-xl backdrop-saturate-150 sm:p-6"
      >
        <div className="flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/45">
            <LineChart className="h-3.5 w-3.5" />
            Price history
          </span>
          <span className="inline-flex items-center gap-2 text-[11px] text-white/35">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-300/70" aria-hidden />
            Live
          </span>
        </div>

        {/* ---- Asset chips + the headline price ------------------------- */}
        <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              {DEMO_ASSETS.map((code) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => setAsset(code)}
                  aria-pressed={asset === code}
                  className={
                    "inline-flex items-center gap-2 rounded-full border py-1.5 pl-1.5 pr-3.5 text-sm font-semibold tracking-tight transition-colors " +
                    (asset === code
                      ? "border-white/30 bg-white/[0.12] text-white"
                      : "border-white/10 bg-white/[0.04] text-white/55 hover:border-white/25 hover:text-white")
                  }
                >
                  <AssetMark asset={ASSETS_BY_CODE[code]} className="h-5 w-5" />
                  {code}
                </button>
              ))}
            </div>

            <p className="mt-4 flex flex-wrap items-baseline gap-x-2.5">
              <span className="text-3xl font-semibold tracking-tight tabular-nums text-white sm:text-4xl">
                {baseAsset.symbol}
                {formatRate(price)}
              </span>
              <span
                className={
                  "text-sm font-semibold tabular-nums " +
                  (change >= 0 ? "text-emerald-300/85" : "text-rose-300/85")
                }
              >
                {change >= 0 ? "+" : ""}
                {change.toFixed(2)}%
              </span>
              <span className="text-xs text-white/35">
                past {WINDOWS.find((w) => w.days === days)?.label}
              </span>
            </p>
          </div>

          {/* ---- Window toggles ---------------------------------------- */}
          <div className="flex items-center gap-1.5">
            {WINDOWS.map((w) => (
              <button
                key={w.days}
                type="button"
                onClick={() => setDays(w.days)}
                aria-pressed={days === w.days}
                className={
                  "rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors " +
                  (days === w.days
                    ? "border-white/30 bg-white/[0.12] text-white"
                    : "border-white/10 bg-white/[0.04] text-white/50 hover:border-white/25 hover:text-white")
                }
              >
                {w.label}
              </button>
            ))}
          </div>
        </div>

        {/* ---- The chart ------------------------------------------------ */}
        {/*
          Keyed by the series so a change of asset or window replays the fade.
          Without the key React reuses the paths and the new line simply appears
          in place, which reads as the chart glitching rather than redrawing —
          the same reason the real row does it.
        */}
        <div key={`${asset}-${days}`} className="mt-6 animate-rise-in">
          <PriceChart points={points} base={BASE} days={days} positive={change >= 0} />
        </div>
      </div>

      <p className="mt-5 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-center text-xs leading-relaxed text-white/30">
        <span>Sample series, the board draws these from the live feed, per asset and pair.</span>
        <Link
          href="/rates"
          className="group inline-flex items-center gap-1 font-semibold text-white/50 transition-colors hover:text-white"
        >
          Open the board
          <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
        </Link>
      </p>
    </section>
  );
};

export default GraphDemo;
