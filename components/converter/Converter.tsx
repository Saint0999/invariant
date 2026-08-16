"use client";

/**
 * Converter.tsx
 * ---------------------------------------------------------------------------
 * The /converter tool: convert any supported asset into any other, in either
 * direction, at live rates. Crypto→crypto, crypto→fiat, fiat→crypto and
 * fiat→fiat are not four features here — every asset carries a USD price, so
 * they are all the same division (see convert() in lib/converter/assets.ts).
 *
 * Same charcoal language as the landing page: a #141416 base lifted by neutral
 * ambient washes, translucent graphite glass over it, brushed-silver headline
 * type. The panel below is the same recipe as the landing page's GlassPanel —
 * light fill, heavy blur, saturate to put back the colour the blur averages
 * away — kept local rather than shared, since that component is private to the
 * landing file and exporting it would couple this route to that page's layout.
 *
 * BOTH AMOUNT FIELDS ARE EDITABLE. `edited` records which side the reader last
 * typed into; that side keeps their raw text and the other is computed from it.
 * Without that flag, formatting the field being typed in would fight the
 * keystrokes — "1.0" becomes "1", and the decimal point can never be entered.
 */

import { useEffect, useMemo, useState, type FC } from "react";
import { ArrowUpDown, RefreshCw } from "lucide-react";

import LiveBadge from "@/components/ui/LiveBadge";

import { ASSETS_BY_CODE, convert } from "@/lib/converter/assets";
import { formatAge, formatAmount, formatRateLine, parseAmount } from "@/lib/converter/format";

import AssetSelect, { AssetMark } from "./AssetSelect";
import { useRates } from "./useRates";

/** Starting pair and a set of one-tap jumps. Chosen to show the tool's range:
 *  a crypto→fiat quote, a crypto→crypto swap, and a stablecoin cash-out. */
const QUICK_PAIRS: Array<{ from: string; to: string }> = [
  { from: "BTC", to: "USD" },
  { from: "ETH", to: "EUR" },
  { from: "BTC", to: "ETH" },
  { from: "SOL", to: "USDT" },
  { from: "USDC", to: "INR" },
  { from: "ETH", to: "BTC" },
];

type Side = "from" | "to";

const Converter: FC = () => {
  const { usdPerUnit, updatedAt, loading, refreshing, error, stale, refresh } = useRates();

  const [fromCode, setFromCode] = useState("BTC");
  const [toCode, setToCode] = useState("USD");
  const [amount, setAmount] = useState("1");
  const [edited, setEdited] = useState<Side>("from");

  const from = ASSETS_BY_CODE[fromCode];
  const to = ASSETS_BY_CODE[toCode];

  const typed = parseAmount(amount);
  const invalid = Number.isNaN(typed);

  /*
    The value of the side the reader is NOT editing. `edited` decides which
    direction the conversion runs, which is the whole of the two-way behaviour:
    typing on the right converts to→from and shows the result on the left.
  */
  const converted = useMemo(() => {
    if (invalid) return null;
    return edited === "from"
      ? convert(typed, fromCode, toCode, usdPerUnit)
      : convert(typed, toCode, fromCode, usdPerUnit);
  }, [invalid, typed, edited, fromCode, toCode, usdPerUnit]);

  const convertedAsset = edited === "from" ? to : from;
  const convertedText =
    converted === null ? "" : formatAmount(converted, convertedAsset);

  const fromValue = edited === "from" ? amount : convertedText;
  const toValue = edited === "to" ? amount : convertedText;

  /** Unit rate for the line under the card, always quoted from→to regardless
   *  of which field is being typed in. */
  const unitRate = convert(1, fromCode, toCode, usdPerUnit);

  /*
    Re-render on a timer purely so "updated 12s ago" counts up. It is derived
    from a clock rather than from state, so nothing else would trigger it and
    the label would sit frozen at "just now" between polls.
  */
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  /** Swap the two sides, keeping the number the reader is looking at on the
   *  side it is currently on — i.e. the pair flips, the quote does not jump. */
  const swap = () => {
    setFromCode(toCode);
    setToCode(fromCode);
    setEdited((side) => (side === "from" ? "to" : "from"));
  };

  /** Picking the asset already on the other side swaps rather than producing a
   *  BTC→BTC quote, which is the only sensible reading of that tap. */
  const pickFrom = (code: string) => (code === toCode ? swap() : setFromCode(code));
  const pickTo = (code: string) => (code === fromCode ? swap() : setToCode(code));

  const hasRates = Object.keys(usdPerUnit).length > 0;

  return (
    <div className="mx-auto w-[min(640px,calc(100%-2rem))]">
      {/* ---- Heading -------------------------------------------------- */}
      <div className="flex flex-col items-center text-center">
        <LiveBadge />

        {/* Brushed-silver clip, same recipe as the landing headline. `pb-1`
            because a clipped gradient crops descenders flush at the box edge. */}
        <h1 className="mt-5 text-balance bg-gradient-to-b from-white via-[#E8E8EC] to-[#9A9AA4] bg-clip-text pb-1 text-4xl font-bold leading-[1.05] tracking-[-0.035em] text-transparent sm:text-5xl">
          Convert crypto and cash, both ways.
        </h1>
        <p className="mt-4 max-w-md text-pretty text-sm leading-relaxed text-white/50 sm:text-base">
          Any of {Object.keys(ASSETS_BY_CODE).length} assets into any other: token to token, or
          token straight to dollars, euros and rupees. Rates refresh every 30 seconds.
        </p>
      </div>

      {/* ---- The card ------------------------------------------------- */}
      <div className="relative mt-10 rounded-3xl border-b border-white/10 bg-[#1D1D21]/40 p-4 shadow-[0_8px_32px_-12px_rgba(0,0,0,0.7)] backdrop-blur-xl backdrop-saturate-150 sm:p-6">
        <AmountRow
          label="You convert"
          assetLabel="Source currency"
          code={fromCode}
          counterpart={toCode}
          onCode={pickFrom}
          value={fromValue}
          onValue={(next) => {
            setEdited("from");
            setAmount(next);
          }}
          readOnly={!hasRates}
          invalid={invalid && edited === "from"}
        />

        {/*
          The swap control sits in the gutter BETWEEN the two rows, overlapping
          both. -my-3 pulls the rows up around it so the button reads as a hinge
          joining them rather than as a third row in the stack.
        */}
        <div className="relative z-10 -my-3 flex justify-center">
          <button
            type="button"
            onClick={swap}
            aria-label={`Swap ${from.code} and ${to.code}`}
            className="group grid h-11 w-11 place-items-center rounded-full border border-white/10 bg-[#26262B] text-white/70 shadow-[0_8px_24px_-8px_rgba(0,0,0,0.9)] transition-colors hover:border-white/25 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
          >
            <ArrowUpDown className="h-4 w-4 transition-transform duration-300 group-hover:rotate-180" />
          </button>
        </div>

        <AmountRow
          label="You receive"
          assetLabel="Destination currency"
          code={toCode}
          counterpart={fromCode}
          onCode={pickTo}
          value={toValue}
          onValue={(next) => {
            setEdited("to");
            setAmount(next);
          }}
          readOnly={!hasRates}
          invalid={invalid && edited === "to"}
        />

        {/* ---- Rate + freshness -------------------------------------- */}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-white/[0.08] pt-4">
          <p className="text-sm text-white/60">
            {loading && !hasRates ? (
              <span className="text-white/40">Loading live rates…</span>
            ) : unitRate !== null ? (
              formatRateLine(from, to, unitRate)
            ) : (
              <span className="text-white/40">Rate unavailable for this pair</span>
            )}
          </p>

          <div className="flex items-center gap-3">
            <span className="flex items-center gap-2 text-xs text-white/40">
              {/*
                The dot is the whole "this is live" signal, so its colour tracks
                the actual state: pulsing while a refresh is in flight, amber
                when the numbers on screen are older than the feed should be.
              */}
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

        {(error || stale) && (
          // rise-in: this is new information landing, not part of the card's
          // resting layout, and popping in flat read as a glitch rather than
          // as the feed telling the reader something changed.
          <p className="mt-3 animate-rise-in text-xs text-amber-200/70">
            {error
              ? "Live feed unreachable. Showing the last rate we received."
              : "The rate provider is slow to respond; this quote may be a few minutes old."}
          </p>
        )}
      </div>

      {/* ---- Quick pairs ---------------------------------------------- */}
      <div className="mt-8">
        <p className="text-center text-[11px] font-semibold uppercase tracking-[0.16em] text-white/35">
          Popular pairs
        </p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {QUICK_PAIRS.map((pair) => {
            const active = pair.from === fromCode && pair.to === toCode;

            return (
              <button
                key={`${pair.from}-${pair.to}`}
                type="button"
                onClick={() => {
                  setFromCode(pair.from);
                  setToCode(pair.to);
                  // Quoting the pair means quoting it from the source side; if
                  // the reader had been typing into the receive field, the
                  // amount they entered belongs to a currency they just left.
                  setEdited("from");
                  if (invalid || typed === 0) setAmount("1");
                }}
                className={
                  "inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-xs font-semibold tracking-tight transition-colors " +
                  (active
                    ? "border-white/30 bg-white/[0.12] text-white"
                    : "border-white/10 bg-white/[0.05] text-white/55 hover:border-white/25 hover:text-white")
                }
              >
                <AssetMark asset={ASSETS_BY_CODE[pair.from]} className="h-4 w-4 text-[8px]" />
                {pair.from} → {pair.to}
              </button>
            );
          })}
        </div>
      </div>

      <p className="mt-10 text-center text-xs leading-relaxed text-white/30">
        {/* The source moved to the footer, where it is stated once for both
            tools. What is left here is what the number means, which is the part
            that belongs next to the number. */}
        Rates are indicative mid-market prices and exclude network and payout fees. They are
        not a quote or an offer to trade.
      </p>
    </div>
  );
};

/* ==========================================================================
 * One side of the converter
 * ========================================================================== */

interface AmountRowProps {
  label: string;
  assetLabel: string;
  code: string;
  counterpart: string;
  onCode: (code: string) => void;
  value: string;
  onValue: (value: string) => void;
  readOnly: boolean;
  invalid: boolean;
}

const AmountRow: FC<AmountRowProps> = ({
  label,
  assetLabel,
  code,
  counterpart,
  onCode,
  value,
  onValue,
  readOnly,
  invalid,
}) => (
  <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-4 sm:p-5">
    <div className="flex items-center justify-between">
      <label className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/35">
        {label}
      </label>
      {invalid && <span className="text-[11px] text-amber-200/80">Enter a number</span>}
    </div>

    <div className="mt-3 flex items-center gap-3">
      {/*
        inputMode="decimal" rather than type="number": a number input brings
        along spinners, swallows the grouping separators in a pasted "1,250",
        and on some browsers scrolls the value while the reader is scrolling the
        page. The text is validated by parseAmount instead.
      */}
      <input
        value={value}
        onChange={(event) => onValue(event.target.value)}
        onFocus={(event) => event.target.select()}
        inputMode="decimal"
        autoComplete="off"
        spellCheck={false}
        placeholder="0"
        aria-label={label}
        disabled={readOnly}
        className="w-full min-w-0 bg-transparent text-2xl font-semibold tracking-tight text-white tabular-nums placeholder:text-white/25 focus:outline-none disabled:text-white/40 sm:text-[1.75rem]"
      />

      <div className="w-[10.5rem] shrink-0 sm:w-44">
        <AssetSelect value={code} onChange={onCode} counterpart={counterpart} label={assetLabel} />
      </div>
    </div>
  </div>
);

export default Converter;
