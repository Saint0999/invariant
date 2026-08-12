"use client";

/**
 * Collapse.tsx
 * ---------------------------------------------------------------------------
 * Animates a block open and shut without anyone having to know how tall it is.
 *
 * WHY THE GRID, RATHER THAN max-height
 * The usual trick is transitioning `max-height` between 0 and a guessed number
 * larger than the content. It is guesswork twice over: too small and the panel
 * clips, too large and the easing is wrong — the transition spends most of its
 * duration animating through empty space, so the panel appears to snap open and
 * then dawdle. A chart panel here is ~270px tall but grows when the readout
 * wraps, so any guess would be wrong on some screen.
 *
 * `grid-template-rows: 0fr → 1fr` animates to the content's ACTUAL height, so
 * the easing is honest at every size and nothing needs measuring. The child
 * must carry `overflow: hidden` — without it the content spills out of the
 * collapsed track instead of being clipped by it.
 *
 * WHY KEYFRAMES, RATHER THAN A TRANSITION
 * A transition needs two committed styles to animate between, so the mounted
 * child has to be painted collapsed and then flipped to expanded — which means
 * gating the flip on requestAnimationFrame. That was the first version of this
 * file and it is quietly fragile: rAF does not run in a background tab, and any
 * environment that throttles it leaves the panel mounted at zero height with
 * the open state already set, i.e. permanently invisible. A keyframe animation
 * runs on mount from its own `from` state, so there is no second style to
 * schedule and nothing to miss.
 *
 * The exit is why this owns mount state at all: a child that unmounts the
 * instant `open` goes false has nothing left to animate, so it is held for the
 * length of the animation and dropped after.
 */

import { useEffect, useState, type FC, type ReactNode } from "react";

/**
 * One constant drives the animation and the unmount timer. They must agree — a
 * timer shorter than the animation cuts the close off partway, a longer one
 * leaves an invisible empty block in the layout — so the duration is applied
 * inline rather than living in a class that could drift from this number. The
 * keyframes themselves are in globals.css.
 */
const DURATION_MS = 300;

export interface CollapseProps {
  open: boolean;
  children: ReactNode;
}

const Collapse: FC<CollapseProps> = ({ open, children }) => {
  /** Is the child in the tree at all? Stays true through the closing animation. */
  const [mounted, setMounted] = useState(open);

  useEffect(() => {
    if (open) {
      setMounted(true);
      return;
    }

    /*
      With animations suppressed there is nothing to wait for, and waiting would
      be worse than not animating: the closing panel has no animation holding it
      at zero height, so it would sit at full height for the duration and then
      vanish — a flash of the thing that was supposed to be closing.
    */
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setMounted(false);
      return;
    }

    const timer = setTimeout(() => setMounted(false), DURATION_MS);
    return () => clearTimeout(timer);
  }, [open]);

  if (!mounted) return null;

  return (
    <div
      className={"grid " + (open ? "animate-panel-open" : "animate-panel-close")}
      style={{ animationDuration: `${DURATION_MS}ms` }}
    >
      {/* overflow-hidden is load-bearing: it is what makes the 0fr track clip
          the content rather than let it overflow at full height. */}
      <div className="overflow-hidden">{children}</div>
    </div>
  );
};

export default Collapse;
