"use client";

/**
 * SmoothScroll.tsx
 * ---------------------------------------------------------------------------
 * Lenis, mounted for the landing page ONLY.
 *
 * It lives in a component rather than in the root layout on purpose: smoothing
 * is a choice about this page, where a pinned scene is being scrubbed and the
 * native wheel's discrete jumps show up as the animation stepping. Anywhere
 * else — docs, an app screen, a form — hijacking the scroll is a cost with no
 * matching benefit, and it breaks the reader's expectation that the wheel
 * moves the page by exactly the amount the OS says it should. Adding this to
 * `app/layout.tsx` would silently opt every future route in.
 *
 * Lenis drives the REAL window scroll — it does not translate a fake viewport —
 * so `scrollY`, `getBoundingClientRect`, `position: sticky` and ordinary scroll
 * events all keep working. That is what lets ScrollPin stay oblivious to it.
 *
 * Renders nothing.
 */

import { useEffect } from "react";
import Lenis from "lenis";

// Ships with the package: `height: auto` on html/body so the page can't fight
// the smoothing, plus the [data-lenis-prevent] escape hatches.
import "lenis/dist/lenis.css";

const SmoothScroll = () => {
  useEffect(() => {
    /*
      Smoothing IS motion, and it is motion applied to the one interaction a
      reader is driving by hand. Leave the native scroll alone when they have
      asked for less of it.
    */
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const lenis = new Lenis({
      /*
        A little longer than the 1.0 default. The pin is scrubbed, so this
        duration is also how long the text keeps easing after the wheel stops —
        too short and the sequence still feels stepped, too long and the page
        keeps sliding after the reader expects it to have settled.
      */
      duration: 1.2,
      /* Wheel only. Touch devices already have momentum from the OS, and
         doubling it up makes a phone feel like it is skating. */
      smoothWheel: true,
      syncTouch: false,
    });

    let frame = requestAnimationFrame(function raf(time: number) {
      lenis.raf(time);
      frame = requestAnimationFrame(raf);
    });

    return () => {
      cancelAnimationFrame(frame);
      lenis.destroy();
    };
  }, []);

  return null;
};

export default SmoothScroll;
