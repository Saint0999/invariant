"use client";

/**
 * ToolPreview.tsx
 * ---------------------------------------------------------------------------
 * Two cards under the currency cloud: a snippet of /converter beside a snippet
 * of /rates.
 *
 * SAMPLE DATA, NOT THE LIVE FEED. Both cards run on the fixed snapshot in
 * lib/landing/demo.ts — see the note there for why a marketing preview is
 * better off frozen than polling. The snapshot keeps the feed's own shape, so
 * convert() and the formatters take it unchanged.
 *
 * THE CARDS DEMO THEMSELVES. The converter types an amount in, swaps to the
 * next pair and re-quotes; the board flashes rows as if ticks were landing.
 * What is animated is the INTERACTION — which pair is on screen, which row just
 * updated — never the prices themselves, which stay put at their snapshot
 * values.
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
import { ASSETS_BY_CODE, CRYPTO_ASSETS, convert, type Asset } from "@/lib/converter/assets";
import { formatAmount, formatRate, parseAmount } from "@/lib/converter/format";
import { DEMO_CHANGE_24H, DEMO_USD_PER_UNIT } from "@/lib/landing/demo";

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

/**
 * The cycle, in milliseconds: per keystroke, how long the finished quote holds,
 * per backspace, and the beat with the field empty before the next pair starts.
 * Deleting is faster than typing because a held-down backspace repeats faster
 * than anyone types.
 */
const TYPE_MS = 120;
const HOLD_MS = 2600;
const DELETE_MS = 55;
const EMPTY_MS = 420;

/** How many assets the rates card's crawl carries before it repeats. */
const MARQUEE_ROWS = 10;

/** Rows are priced in USD here — the card has no base selector to change it. */
const PREVIEW_BASE = "USD";

const ToolPreview: FC = () => {
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
        <ConverterCard reduced={reduced} />
        <RatesCard />
      </div>

      {/*
        Says plainly what the cards are. The "Live" marker on each one refers to
        the tools these link to, not to the sample figures beside it, and that
        distinction is not one a reader can be expected to infer — so it is
        written down rather than implied.

        Both routes are named and linked, because "check the respective pages"
        is only useful to someone who already knows which those are.
      */}
      <p className="mt-6 text-center text-xs leading-relaxed text-white/30">
        Sample figures for illustration, these two cards are a demo and do not
        update. For live pricing, open the{" "}
        <Link
          href="/converter"
          className="font-semibold text-white/50 underline-offset-2 transition-colors hover:text-white hover:underline"
        >
          converter
        </Link>{" "}
        or the{" "}
        <Link
          href="/rates"
          className="font-semibold text-white/50 underline-offset-2 transition-colors hover:text-white hover:underline"
        >
          rates board
        </Link>
        .
      </p>
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
  children: ReactNode;
}

/**
 * The card shell — same glass recipe as the navbar and the two tools (light
 * fill, heavy blur, saturate to put back what the blur averages away) so these
 * read as pieces of the product rather than as marketing tiles.
 *
 * The whole card is the link and there is no button inside it, so the hover
 * affordance has to come from the surface itself: the border lifts and the fill
 * warms a shade. `group` carries that down to the children.
 *
 * COLOUR ONLY — the card does not move. An earlier pass also raised it 2px on
 * hover, which on a card carrying a live crawl and a self-typing field meant
 * three things moving at once, and the lift was the one the reader had not
 * asked for.
 */
const PreviewCard: FC<CardProps> = ({
  href,
  eyebrow,
  icon,
  title,
  label,
  children,
}) => (
  <Link
    href={href}
    aria-label={label}
    className="group flex flex-col rounded-3xl border border-white/[0.08] border-b-white/10 bg-[#1D1D21]/40 p-5 shadow-[0_8px_32px_-12px_rgba(0,0,0,0.7)] backdrop-blur-xl backdrop-saturate-150 transition-[border-color,background-color] duration-300 hover:border-white/20 hover:bg-[#1D1D21]/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 motion-reduce:transition-none sm:p-6"
  >
    <div className="flex items-center justify-between gap-3">
      <span className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/45">
        {icon}
        {eyebrow}
      </span>
      <FeedDot />
    </div>

    <h3 className="mt-3 text-lg font-semibold tracking-tight text-white sm:text-xl">
      {title}
    </h3>

    {/* flex-1 so both bodies fill their card and the two stay the same height
        even though the board lists five rows against the converter's two. */}
    <div className="mt-5 flex flex-1 flex-col justify-center">{children}</div>
  </Link>
);

/**
 * The freshness marker the tools carry, minus the states a preview cannot be
 * in. On the real pages this dot goes amber on a stale feed and pulses while a
 * refresh is in flight; here the data is a constant, so it only ever has one
 * thing to say — the tools on the other side of the link are live.
 */
const FeedDot: FC = () => (
  <span className="inline-flex items-center gap-2 text-[11px] text-white/35">
    <span className="h-1.5 w-1.5 rounded-full bg-emerald-300/70" aria-hidden />
    Live
  </span>
);

/* ==========================================================================
 * Converter card
 * ========================================================================== */

/**
 * Runs the typing demo: types the current pair's amount a character at a time,
 * holds the finished quote, BACKSPACES it, and only then moves to the next
 * pair.
 *
 * The delete matters. Clearing the field in one frame is the one moment that
 * gives the demo away — a person emptying an input holds the key down and the
 * digits go one at a time, so a value that vanishes whole reads as a component
 * re-rendering rather than as somebody using a converter. It also gives the
 * pair swap somewhere to happen: the assets change while the field is empty,
 * which is when a real reader would change them, instead of mid-number where
 * the receive side would briefly quote the new pair at the old amount.
 *
 * Backspacing runs faster than typing for the same reason it does in life — the
 * key repeats.
 *
 * Returns the typed TEXT rather than a number, and the card converts from it,
 * so the receive side lands on 0.5 BTC on the way to 0.55 exactly as it does
 * when a person is typing into the real field.
 */
type DemoPhase = "typing" | "deleting";

function useTypingDemo(reduced: boolean): { index: number; typed: string } {
  const [index, setIndex] = useState(0);
  const [typed, setTyped] = useState(DEMO_PAIRS[0].amount);
  const [phase, setPhase] = useState<DemoPhase>("typing");

  /*
    One timer per step rather than one interval for the whole cycle: each step
    has its own delay (a keystroke, a hold, a backspace, the beat on empty),
    and an interval can only have one. Re-running on every character is what
    makes the phase changes fall out of the same code path.
  */
  useEffect(() => {
    if (reduced) return;

    const target = DEMO_PAIRS[index].amount;

    let delay: number;
    let step: () => void;

    if (phase === "typing") {
      if (typed.length < target.length) {
        delay = TYPE_MS;
        step = () => setTyped(target.slice(0, typed.length + 1));
      } else {
        delay = HOLD_MS;
        step = () => setPhase("deleting");
      }
    } else if (typed.length > 0) {
      delay = DELETE_MS;
      step = () => setTyped((current) => current.slice(0, -1));
    } else {
      delay = EMPTY_MS;
      step = () => {
        setIndex((i) => (i + 1) % DEMO_PAIRS.length);
        setPhase("typing");
      };
    }

    const timer = setTimeout(step, delay);
    return () => clearTimeout(timer);
  }, [index, phase, typed, reduced]);

  /* Reduced motion gets the first pair, finished, and no timers at all. */
  useEffect(() => {
    if (!reduced) return;
    setIndex(0);
    setTyped(DEMO_PAIRS[0].amount);
    setPhase("typing");
  }, [reduced]);

  return { index, typed };
}

const ConverterCard: FC<{ reduced: boolean }> = ({ reduced }) => {
  const { index, typed } = useTypingDemo(reduced);
  const pair = DEMO_PAIRS[index];

  const from = ASSETS_BY_CODE[pair.from];
  const to = ASSETS_BY_CODE[pair.to];

  const amount = parseAmount(typed);
  const result = Number.isNaN(amount)
    ? null
    : convert(amount, pair.from, pair.to, DEMO_USD_PER_UNIT);
  const unitRate = convert(1, pair.from, pair.to, DEMO_USD_PER_UNIT);

  return (
    <PreviewCard
      href="/converter"
      eyebrow="Converter"
      icon={<ArrowUpDown className="h-3.5 w-3.5" />}
      title="Any token into any currency."
      label="Open the converter"
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

/**
 * The scrolling list.
 *
 * A MARQUEE, NOT A HIGHLIGHT CYCLE. The previous version lit one row at a time
 * to suggest ticks landing, and it read as a widget picking rows at random —
 * the eye tracks the flash, not the prices. A slow crawl shows what the card is
 * actually claiming: that there are far more assets on the board than fit here,
 * and they all carry a price.
 *
 * The track holds TWO copies of the list and travels exactly -50%, which is the
 * whole trick: at the end of the run the second copy sits precisely where the
 * first began, so restarting the animation is invisible and the loop has no
 * seam. Any other distance, or an odd number of copies, and the list visibly
 * jumps back to the top.
 */
const RatesCard: FC = () => {
  /* Market-cap order, as assets.ts already carries it. Enough rows that the
     loop is not obviously short, few enough that the duplicated track stays
     cheap — the crawl is a transform, but every row is still real DOM. */
  const rows = useMemo(
    () =>
      CRYPTO_ASSETS.slice(0, MARQUEE_ROWS).map((asset) => ({
        asset,
        price: convert(1, asset.code, PREVIEW_BASE, DEMO_USD_PER_UNIT),
        change: DEMO_CHANGE_24H[asset.code] ?? null,
      })),
    [],
  );

  return (
    <PreviewCard
      href="/rates"
      eyebrow="Live rates"
      icon={<TrendingUp className="h-3.5 w-3.5" />}
      title="Every rate on one board."
      label="See the full rates board"
    >
      {/*
        Fixed height, so the card shows a window onto the list rather than the
        whole of it. Masked top and bottom: without the fade the rows are sliced
        flat at the edges and the crawl reads as content overflowing a box
        instead of as a list running past.
      */}
      <div
        className="relative h-[16.5rem] overflow-hidden [-webkit-mask-image:linear-gradient(to_bottom,transparent,#000_12%,#000_88%,transparent)] [mask-image:linear-gradient(to_bottom,transparent,#000_12%,#000_88%,transparent)]"
        aria-hidden
      >
        {/* The crawl pauses on hover — that pairing lives in globals.css beside
            the animation itself, since a Tailwind variant cannot override an
            unlayered rule. See the note there. */}
        <div className="animate-marquee-y">
          {[0, 1].map((copy) => (
            <ul key={copy}>
              {rows.map(({ asset, price, change }) => (
                <MarqueeRow
                  key={asset.code}
                  asset={asset}
                  price={price}
                  change={change}
                />
              ))}
            </ul>
          ))}
        </div>
      </div>

      {/*
        The list is aria-hidden — it is duplicated, so a screen reader would
        read every asset twice — and this line carries the same information in
        the form that is actually useful without sight of the crawl.
      */}
      <p className="sr-only">
        A sample of the board: {rows.map(({ asset }) => asset.name).join(", ")}, and more.
      </p>
    </PreviewCard>
  );
};

/** One row of the crawl. Static by design: nothing about a row changes while
 *  it travels, so the only moving part is the track's transform. */
const MarqueeRow: FC<{
  asset: Asset;
  price: number | null;
  change: number | null;
}> = ({ asset, price, change }) => {
  const base = ASSETS_BY_CODE[PREVIEW_BASE];

  return (
    <li className="flex h-[3.3rem] items-center gap-3 border-b border-white/[0.05] px-0.5">
      <AssetMark asset={asset} className="h-7 w-7" />
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold tracking-tight text-white">{asset.code}</p>
        <p className="truncate text-xs text-white/40">{asset.name}</p>
      </div>

      <div className="ml-auto text-right">
        <p className="text-sm font-semibold tabular-nums text-white/85">
          {price === null ? "—" : `${base.symbol}${formatRate(price)}`}
        </p>
        <Change value={change} />
      </div>
    </li>
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
