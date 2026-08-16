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
 * "use client" because of the arming effect below. It was previously absent,
 * on the grounds that both callers are already client components and nothing
 * here held state; the first half of that is still true, so the directive
 * costs nothing, but the second is not, and a server caller would now fail.
 */

"use client";

import { TrendingUp } from "lucide-react";
import { useEffect, useState, type FC } from "react";

export interface LiveBadgeProps {
  /**
   * How long the pill sits still before its first glint, in milliseconds,
   * measured from the moment the badge is on screen.
   */
  delayMs?: number;
}

/**
 * Long enough that the pill is unmistakably at rest before anything moves —
 * the glint should read as something that happens TO a settled page, not as
 * part of its arrival. The tool routes fade their heading in over 420ms after
 * a 90ms beat (see .animate-page-in), so this also clears that comfortably.
 */
const DEFAULT_DELAY_MS = 900;

const LiveBadge: FC<LiveBadgeProps> = ({ delayMs = DEFAULT_DELAY_MS }) => {
  /*
    The sweep is armed on mount rather than by the stylesheet alone, and this
    is the whole fix for a glint that arrived looking stuck.

    A CSS animation is timed against the DOCUMENT timeline, whose origin is
    navigation start — not first paint, and not this element's first paint. On
    /converter the heading was painting around 2.4s in, by which point the
    sweep was already ~60% across: the reader's first sight of the pill was a
    highlight parked most of the way over, finishing, and then going dark for
    the rest of the cycle. The animation was not stuck, it was most of the way
    through a run that nobody had been present for.

    Applying the class from script starts the clock where the class lands, so
    the delay above becomes a real wait rather than a countdown a slow route
    can spend before anyone is looking. It self-corrects across environments,
    which a bigger hardcoded delay cannot: a number tuned to a dev server that
    paints at 2.4s would leave the pill dead for seconds in production, and one
    tuned to production would not have fixed this at all.

    The rAF is not a tidy-up, it is the part that works. An effect alone still
    reproduced the bug: effects run at hydration, which here completes before
    the document has rendered a single frame, and until that first frame the
    document timeline still reads 0 — so the animation was handed the very
    start time we were trying to get away from. rAF only fires on a real
    rendering opportunity, which is the earliest moment the timeline is live
    and the pill is genuinely in front of someone.
  */
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setArmed(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <span className="relative inline-flex items-center gap-2 overflow-hidden rounded-full border border-white/10 bg-white/[0.06] px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/50">
      {/*
        The sheen. overflow-hidden on the pill is load-bearing: the band is as
        wide as the pill and travels a full width in each direction, so without
        the clip it would be visible sweeping across the page either side.

        Sits UNDER the content rather than over it. A highlight passing on top of
        the label dims the type for the moment it crosses, which reads as a
        flicker; behind it, the pill's own fill catches the light and the text
        stays put. See .animate-sheen in globals.css for the timing.

        Held at opacity-0 until armed. Unarmed it carries no animation at all,
        so it would otherwise paint at its natural position — a stationary bright
        band across the middle of the pill, which is exactly the artefact the
        keyframes are shaped to avoid. Once armed, .animate-sheen's `backwards`
        fill takes over the same job for the length of the delay.

        The inline delay is a longhand and beats the shorthand's own value in
        .animate-sheen, which is what lets a caller retime the glint.
      */}
      <span
        className={`pointer-events-none absolute inset-0 bg-[linear-gradient(105deg,transparent_38%,rgba(255,255,255,0.28)_50%,transparent_62%)] ${
          armed ? "animate-sheen" : "opacity-0"
        }`}
        style={{ animationDelay: `${delayMs}ms` }}
        aria-hidden
      />

      {/* Both children lift onto their own layer so the absolute sheen cannot
          paint over them. */}
      <TrendingUp className="relative h-3.5 w-3.5" />
      <span className="relative">Live market rates</span>
    </span>
  );
};

export default LiveBadge;
