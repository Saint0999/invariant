/**
 * LiveBadge.tsx
 * ---------------------------------------------------------------------------
 * The "Live market rates" pill above the heading on /converter and /rates.
 *
 * Extracted when the sheen arrived. The markup was already duplicated
 * byte-for-byte in Converter.tsx and RatesBoard.tsx, and the two headings sit
 * one nav click apart — a sweep that ran at a different angle or speed on each
 * page would be obvious precisely because a reader sees both in a row.
 *
 * No "use client" of its own. Both callers are already client components, and
 * nothing here needs state, so it costs the same either way.
 */

import { TrendingUp } from "lucide-react";
import type { FC } from "react";

const LiveBadge: FC = () => (
  <span className="relative inline-flex items-center gap-2 overflow-hidden rounded-full border border-white/10 bg-white/[0.06] px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/50">
    {/*
      The sheen. overflow-hidden on the pill is load-bearing: the band is as
      wide as the pill and travels a full width in each direction, so without
      the clip it would be visible sweeping across the page either side.

      Sits UNDER the content rather than over it. A highlight passing on top of
      the label dims the type for the moment it crosses, which reads as a
      flicker; behind it, the pill's own fill catches the light and the text
      stays put. See .animate-sheen in globals.css for the timing.
    */}
    <span
      className="animate-sheen pointer-events-none absolute inset-0 bg-[linear-gradient(105deg,transparent_38%,rgba(255,255,255,0.28)_50%,transparent_62%)]"
      aria-hidden
    />

    {/* Both children lift onto their own layer so the absolute sheen cannot
        paint over them. */}
    <TrendingUp className="relative h-3.5 w-3.5" />
    <span className="relative">Live market rates</span>
  </span>
);

export default LiveBadge;
