"use client";

/**
 * PageBottomBlur.tsx
 * ---------------------------------------------------------------------------
 * The viewport-bottom GradualBlur, plus the one behaviour it does not ship with:
 * it gets out of the way once the footer arrives, and comes straight back when
 * the user scrolls up again.
 *
 * WHY
 * ---------------------------------------------------------------------------
 * A `fixed` bottom blur is right while there is more page below the fold — it
 * reads as "content continues past the edge". Over the footer that reading is
 * false, and the effect just smears the one part of the page carrying small
 * print and legal links.
 *
 * ANCHORED TO THE FOOTER, NOT TO A SCROLL DISTANCE
 * ---------------------------------------------------------------------------
 * The obvious implementation — fade out over the last N px of scroll — needs N
 * to exceed the footer's height or the footer's top edge sits under a
 * full-strength blur. That coupling is invisible and breaks the moment the
 * footer changes: it is 101px tall on desktop but 137px on mobile, where the
 * row stacks, and a link added later moves both numbers.
 *
 * So the fade is driven by the footer's own position instead. The rule is
 * simply "the blur is never on top of the footer": opacity reaches 0 by the
 * time the footer's first pixel touches the blur band, whatever height either
 * of them happens to be, at any viewport.
 *
 * The fade tracks scroll position directly rather than running a CSS
 * transition, so it follows the gesture 1:1 and reverses the instant the user
 * scrolls back up. Reads are batched into a rAF because getBoundingClientRect
 * forces layout, and doing that per scroll event is a classic jank source.
 */

import { useEffect, useState } from "react";

import GradualBlur from "./GradualBlur";

/** Height of the blur band. Shared with the GradualBlur `height` prop below. */
const BLUR_HEIGHT = 64;

/**
 * How far below the blur band the footer's top edge must sit for the blur to be
 * at full strength. The fade plays out across this much scroll travel, ending
 * before the footer reaches the band.
 */
const FADE_TRAVEL = 120;

/**
 * The element the blur must never cover. Matches the landing footer, which
 * already carries this id as a nav anchor.
 */
const REVEAL_SELECTOR = "#security";

const PageBottomBlur = () => {
  /*
    Starts at 0 so a page shorter than the viewport — nothing below the fold,
    footer already on screen — never flashes a blur before the first measurement
    lands.
  */
  const [opacity, setOpacity] = useState(0);

  useEffect(() => {
    let frame = 0;

    const measure = () => {
      frame = 0;

      const footer = document.querySelector(REVEAL_SELECTOR);
      if (!footer) {
        // No footer to protect: nothing to fade for, so stay at full strength.
        setOpacity(1);
        return;
      }

      // Distance from the top of the blur band down to the footer's first pixel.
      // Negative once the footer has entered the band.
      const bandTop = window.innerHeight - BLUR_HEIGHT;
      const clearance = footer.getBoundingClientRect().top - bandTop;

      setOpacity(Math.min(1, Math.max(0, clearance / FADE_TRAVEL)));
    };

    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };

    measure();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);

    /*
      Content that settles after mount (fonts, the 3D canvas sizing, images)
      moves the footer without firing scroll or resize.
    */
    const observer = new ResizeObserver(schedule);
    observer.observe(document.documentElement);

    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      observer.disconnect();
    };
  }, []);

  return (
    <GradualBlur
      target="page"
      position="bottom"
      height={`${BLUR_HEIGHT}px`}
      strength={2}
      divCount={6}
      /*
        ease-in holds the blur near zero for most of the band and stacks it into
        the last few pixels, so it reads as a soft edge rather than a frosted
        strip across the bottom of the page. ease-out does the opposite and was
        far too dominant here.
      */
      curve="ease-in"
      /*
        GradualBlur spreads `style` last, so this wins over its own opacity —
        the intended extension point, not a hack around it.
      */
      style={{ opacity }}
    />
  );
};

export default PageBottomBlur;
