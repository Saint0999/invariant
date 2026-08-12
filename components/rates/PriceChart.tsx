"use client";

/**
 * PriceChart.tsx
 * ---------------------------------------------------------------------------
 * The line chart inside an expanded row. Hand-rolled SVG rather than a charting
 * library: this draws one series with no axes, no legend and no second scale,
 * which is about eighty lines here against ~50KB of runtime for the smallest
 * library that would do it — and the project has no charting dependency to
 * amortise that against.
 *
 * SCALING
 * The path is built in a fixed 0–100 viewBox and stretched with
 * preserveAspectRatio="none", so the chart fills whatever width the row is
 * without re-rendering on resize. That would normally smear the stroke — a
 * non-uniform scale distorts line width — which is what `vector-effect:
 * non-scaling-stroke` exists to prevent: the geometry stretches, the stroke
 * stays 1.5px.
 *
 * The vertical domain is padded rather than fitted flush to min/max, because a
 * series that touches the top and bottom edges reads as clipped. The padding
 * has a floor: see FLAT_THRESHOLD.
 */

import { useMemo, useRef, useState, type FC, type PointerEvent } from "react";

import { formatRate } from "@/lib/converter/format";
import { ASSETS_BY_CODE } from "@/lib/converter/assets";

export type HistoryPoint = [number, number];

export interface PriceChartProps {
  points: HistoryPoint[];
  /** Code the series is denominated in, for the readout. */
  base: string;
  /** Window length in days — decides how the hover timestamp is written. */
  days: number;
  /** Drives the line colour, matching the row's own change figure. */
  positive: boolean;
}

/**
 * Below this relative spread the series is treated as flat and given a fixed
 * ±0.25% domain instead of being fitted.
 *
 * This is what stops a stablecoin from looking like a mountain range: USDT
 * moves about 0.02% across a week, and a domain fitted to that magnifies pure
 * quote noise into dramatic peaks. The reader's honest takeaway for USDT is "it
 * is flat", and only an unfitted domain says that.
 */
const FLAT_THRESHOLD = 0.005;

const HEIGHT = 100;
const WIDTH = 100;

const PriceChart: FC<PriceChartProps> = ({ points, base, days, positive }) => {
  const [hover, setHover] = useState<number | null>(null);
  const frameRef = useRef<HTMLDivElement>(null);

  const baseAsset = ASSETS_BY_CODE[base];
  const stroke = positive ? "#6EE7B7" : "#FDA4AF";

  const { line, area, project, low, high } = useMemo(() => {
    const values = points.map(([, v]) => v);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const mid = (min + max) / 2 || 1;

    // Flat series get a fixed window; everything else gets an 8% breathing gap
    // above and below so the line never touches the frame.
    const spread = (max - min) / mid;
    const pad = spread < FLAT_THRESHOLD ? mid * 0.0025 : (max - min) * 0.08;
    const lo = min - pad;
    const hi = max + pad;
    const span = hi - lo || 1;

    const x = (i: number) => (i / (points.length - 1)) * WIDTH;
    const y = (v: number) => HEIGHT - ((v - lo) / span) * HEIGHT;

    const line = points.map(([, v], i) => `${i === 0 ? "M" : "L"}${x(i)},${y(v)}`).join(" ");
    // Closed back along the baseline for the gradient fill underneath.
    const area = `${line} L${WIDTH},${HEIGHT} L0,${HEIGHT} Z`;

    return { line, area, project: { x, y }, low: min, high: max };
  }, [points]);

  const active = hover === null ? null : points[hover];

  /** Map pointer position to the nearest sample. Done against the element's
   *  own rect, so it is independent of how the viewBox was stretched. */
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const rect = frameRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return;

    const ratio = (event.clientX - rect.left) / rect.width;
    const index = Math.round(ratio * (points.length - 1));
    setHover(Math.max(0, Math.min(points.length - 1, index)));
  };

  const stamp = (t: number) =>
    new Date(t).toLocaleString("en-US",
      days === 1
        ? { hour: "numeric", minute: "2-digit" }
        : { month: "short", day: "numeric", hour: "numeric" },
    );

  const prefix = baseAsset?.kind === "fiat" && baseAsset.symbol ? baseAsset.symbol : "";

  return (
    <div>
      {/* ---- Readout ------------------------------------------------- */}
      {/*
        min-h-5 rather than h-5: it reserves the line so scrubbing the chart
        never shifts the layout under the cursor, but still lets the text wrap
        on a narrow screen instead of spilling out of a fixed 20px box.
      */}
      <div className="mb-2 flex min-h-5 flex-wrap items-baseline justify-between gap-x-3 text-xs">
        <span className="tabular-nums text-white/70">
          {active ? (
            <>
              <span className="font-semibold text-white">
                {prefix}
                {formatRate(active[1])}
              </span>{" "}
              <span className="text-white/35">{stamp(active[0])}</span>
            </>
          ) : (
            <span className="text-white/35">
              {points.length} points
              {/* Desktop only — there is no hovering on a touch screen, and the
                  gesture there is a drag along the chart, which needs no
                  instruction. */}
              <span className="hidden sm:inline"> · hover to inspect</span>
            </span>
          )}
        </span>
        <span className="tabular-nums text-white/35">
          low {prefix}
          {formatRate(low)} · high {prefix}
          {formatRate(high)}
        </span>
      </div>

      <div
        ref={frameRef}
        className="relative h-40 w-full touch-none"
        onPointerMove={onPointerMove}
        onPointerLeave={() => setHover(null)}
      >
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          preserveAspectRatio="none"
          className="h-full w-full overflow-visible"
          aria-hidden
        >
          <defs>
            <linearGradient id={`fill-${base}-${positive}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={stroke} stopOpacity={0.22} />
              <stop offset="100%" stopColor={stroke} stopOpacity={0} />
            </linearGradient>
          </defs>

          <path d={area} fill={`url(#fill-${base}-${positive})`} />
          <path
            d={line}
            fill="none"
            stroke={stroke}
            strokeWidth={1.5}
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />

          {active && (
            <line
              x1={project.x(hover as number)}
              y1={0}
              x2={project.x(hover as number)}
              y2={HEIGHT}
              stroke="rgba(255,255,255,0.25)"
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            />
          )}
        </svg>

        {/*
          ---- The marker ------------------------------------------------
          An HTML element rather than an SVG <circle>, because inside that
          viewBox there is no such thing as a circle: preserveAspectRatio="none"
          scales x and y by different factors, so any radius drawn in viewBox
          units comes out as an ellipse whose eccentricity depends on how wide
          the row happens to be. (The previous marker was a rect sized
          separately per axis for exactly that reason — the one shape that
          survives the stretch.)

          Positioned OUTSIDE the stretched space, in percentages of the frame.
          project.x/y already return 0–100 in a viewBox that fills the frame in
          both directions, so a viewBox unit and a percent are the same number
          here — no conversion, and it stays correct at any width.
        */}
        {active && (
          <span
            className="pointer-events-none absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[#141416]"
            style={{
              left: `${project.x(hover as number)}%`,
              top: `${project.y(active[1])}%`,
              backgroundColor: stroke,
            }}
            aria-hidden
          />
        )}
      </div>
    </div>
  );
};

export default PriceChart;
