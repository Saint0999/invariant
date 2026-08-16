"use client";

/**
 * ScrollFloat.tsx
 * ---------------------------------------------------------------------------
 * A port of React Bits' ScrollFloat: text split to characters, each one rising
 * into place from below the line while it un-squashes, scrubbed to the scroll
 * position rather than played on a timer.
 *
 * The published component is GSAP + ScrollTrigger. This one is hand-rolled on a
 * rAF-throttled scroll listener instead, because GSAP would be a new runtime
 * dependency for a single effect, and everything it is doing here — one
 * `fromTo` scrubbed between two scroll offsets — is about forty lines without
 * it. The values are the reference's: opacity 0→1, y 120%→0, scaleY 2.3→1,
 * scaleX 0.7→1 about a 50% 0% origin, 0.03 stagger, back.inOut(2).
 *
 * TWO WAYS TO DRIVE IT
 * ---------------------------------------------------------------------------
 * Inside a <ScrollPin> the block takes a SLICE of the pin's progress via
 * `from`/`to`, and its own position on the page is irrelevant — which is the
 * whole point, because a pinned element does not move relative to the viewport
 * and geometry-based triggers freeze solid the moment the pin engages.
 *
 * Outside one it falls back to measuring itself against the viewport, below.
 *
 * TRIGGER GEOMETRY (standalone mode only)
 * ---------------------------------------------------------------------------
 * `start` and `end` are viewport fractions, matching ScrollTrigger's semantics:
 *
 *   start — progress is 0 until the element's CENTRE reaches `start` × viewport
 *           height. Above 1 means "before it has scrolled into view at all";
 *           below 1 means the element is already on screen and sitting still
 *           until the reader scrolls further. That is what lets several of
 *           these fire in sequence rather than all at once.
 *   end   — progress hits 1 when the element's BOTTOM reaches `end` × viewport
 *           height.
 *
 * If the document is too short for the element to ever reach `end`, both
 * offsets shift up so the animation still completes at the bottom of the page.
 * Without that guard the last block on a short page would stay half-formed.
 */

import { Fragment, useEffect, useLayoutEffect, useMemo, useRef } from "react";

import { usePinProgress } from "./ScrollPin";

/** useLayoutEffect warns during SSR; the first paint still needs to be correct. */
const useIsomorphicLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

/**
 * gsap's back.inOut(2), inlined — the ease ScrollFloat ships with. It
 * overshoots at both ends, which is where the "pop" comes from: characters
 * dip slightly past their squash before snapping up to their resting size.
 */
const backInOut = (x: number): number => {
  const s = 1.525 * 2;
  let t = x * 2;
  if (t < 1) return 0.5 * (t * t * ((s + 1) * t - s));
  t -= 2;
  return 0.5 * (t * t * ((s + 1) * t + s) + 2);
};

const clamp01 = (n: number): number => (n < 0 ? 0 : n > 1 ? 1 : n);

export interface ScrollFloatProps {
  /** Plain text. Splitting markup into characters is out of scope. */
  children: string;
  /** Classes for the block wrapper. */
  className?: string;
  /**
   * Classes for every character span. This is where a gradient belongs, NOT on
   * an ancestor: `background-clip: text` does not follow a transformed
   * descendant, so a clipped gradient on the parent leaves the moving
   * characters painted in nothing at all.
   */
  charClassName?: string;
  /** Viewport fraction the element's centre must reach to start. Ignored under a pin. */
  start?: number;
  /** Viewport fraction the element's bottom must reach to finish. Ignored under a pin. */
  end?: number;
  /** Point in the enclosing pin's 0–1 progress where this block begins. */
  from?: number;
  /** Point in the enclosing pin's progress where it is fully resolved. */
  to?: number;
  /** Peak blur radius in px, cleared as each character resolves. */
  blur?: number;
  /** Seconds between neighbouring characters, in the timeline's own units. */
  stagger?: number;
  /** Length of a single character's animation, same units. */
  duration?: number;
}

const ScrollFloat = ({
  children,
  className = "",
  charClassName = "",
  start = 1.3,
  end = 0.85,
  from = 0,
  to = 1,
  blur = 10,
  stagger = 0.03,
  duration = 1,
}: ScrollFloatProps) => {
  const containerRef = useRef<HTMLSpanElement | null>(null);
  const pin = usePinProgress();

  /*
    Split to words first, then characters. The reference splits straight to
    characters, which lets a line wrap in the middle of a word once every
    character is its own inline-block — fine for a one-word demo heading, not
    for a sentence. Words are `whitespace-nowrap` and the spaces between them
    are ordinary text nodes, so wrapping happens only where it should.
  */
  const { words, charCount } = useMemo(() => {
    let index = 0;
    const split = children.split(" ").map((word) => ({
      key: word + index,
      chars: Array.from(word).map((char) => ({ char, index: index++ })),
    }));
    return { words: split, charCount: index };
  }, [children]);

  useIsomorphicLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const chars = Array.from(el.querySelectorAll<HTMLElement>("[data-char]"));
    if (chars.length === 0) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    /** Total timeline length: the last character still needs its full run. */
    const span = duration + stagger * Math.max(0, charCount - 1);

    let frame = 0;

    /** Draw the block at a 0–1 progress of its own timeline. */
    const paint = (progress: number) => {
      const elapsed = progress * span;

      chars.forEach((char, i) => {
        const eased = backInOut(clamp01((elapsed - i * stagger) / duration));
        const remaining = 1 - eased;

        char.style.opacity = String(clamp01(eased));
        char.style.transform = `translateY(${remaining * 120}%) scaleY(${
          1 + remaining * 1.3
        }) scaleX(${1 - remaining * 0.3})`;

        /*
          Defocus, resolving as the character lands. Cleared outright at the
          end rather than left at blur(0): a filter of any value keeps the
          character on its own compositing layer and re-rasterising, and there
          is no reason to pay that for the whole time the headline is just
          sitting there finished.

          `remaining` is clamped to 0 first because back.inOut overshoots — a
          negative remaining would compute a negative radius, which is invalid
          and drops the whole declaration.
        */
        char.style.filter = remaining > 0.01 ? `blur(${clamp01(remaining) * blur}px)` : "";
      });
    };

    /**
     * Pinned: this block owns the [from, to] slice of the pin's progress,
     * scrubbed live off it — scrolling back up runs the reveal in reverse,
     * same as scrolling down runs it forward.
     */
    const onPin = (pinned: number) => {
      const progress = to > from ? clamp01((pinned - from) / (to - from)) : 1;
      paint(progress);
    };

    /** Standalone: measure this block against the viewport. */
    const measure = () => {
      frame = 0;

      const rect = el.getBoundingClientRect();
      const viewport = window.innerHeight;
      const scrolled = window.scrollY;
      const top = rect.top + scrolled;

      let opens = top + rect.height / 2 - start * viewport;
      let closes = top + rect.height - end * viewport;

      const max = document.documentElement.scrollHeight - viewport;
      if (closes > max) {
        const overshoot = closes - max;
        opens -= overshoot;
        closes -= overshoot;
      }

      paint(closes > opens ? clamp01((scrolled - opens) / (closes - opens)) : 1);
    };

    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };

    const settle = () => {
      chars.forEach((char) => {
        char.style.opacity = "1";
        char.style.transform = "none";
        char.style.filter = "";
      });
    };

    let unsubscribe: (() => void) | undefined;

    const bind = () => {
      unsubscribe?.();
      unsubscribe = undefined;
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);

      if (reduced.matches) {
        settle();
        return;
      }

      if (pin) {
        // subscribe() replays the current value, so this also does first paint.
        unsubscribe = pin.subscribe(onPin);
        return;
      }

      window.addEventListener("scroll", onScroll, { passive: true });
      window.addEventListener("resize", onScroll);
      measure();
    };

    bind();
    reduced.addEventListener("change", bind);

    return () => {
      if (frame) cancelAnimationFrame(frame);
      unsubscribe?.();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      reduced.removeEventListener("change", bind);
    };
  }, [blur, charCount, duration, end, from, pin, stagger, start, to]);

  return (
    /*
      overflow-hidden so a character rising from 120% below is masked by its own
      line rather than showing through the block beneath it. Characters render
      at their RESTING values and are moved by the effect on mount — the other
      way round, anyone without JS gets a permanently invisible headline.
    */
    <span ref={containerRef} className={"block overflow-hidden " + className}>
      {words.map(({ key, chars }, wordIndex) => (
        <Fragment key={key}>
          {/* An ordinary space text node OUTSIDE the nowrap span — inside it,
              the space would be unbreakable and the line would never wrap. */}
          {wordIndex > 0 ? " " : null}
          <span className="inline-block whitespace-nowrap">
            {chars.map(({ char, index }) => (
              <span
                key={index}
                data-char
                className={"inline-block will-change-[opacity,transform,filter] " + charClassName}
                style={{ transformOrigin: "50% 0%" }}
              >
                {char}
              </span>
            ))}
          </span>
        </Fragment>
      ))}
    </span>
  );
};

export default ScrollFloat;
