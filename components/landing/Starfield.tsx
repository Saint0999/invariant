/**
 * Starfield.tsx
 * ---------------------------------------------------------------------------
 * A sparse field of stars behind the closing call to action.
 *
 * PLAIN SVG, NOT A CANVAS
 * ---------------------------------------------------------------------------
 * The obvious alternative was another WebGL quad, and it would have been the
 * wrong tool twice over: a whole GPU context and a shader compile to draw a
 * hundred dots that never move, on a card most readers reach after the hero has
 * already claimed a context. This renders as markup, costs nothing to paint,
 * and needs no client JavaScript at all — the twinkle is CSS.
 *
 * WHY THE POSITIONS ARE SEEDED
 * ---------------------------------------------------------------------------
 * Math.random() would place the stars differently on the server than on the
 * client, and React would report a hydration mismatch on every load. A seeded
 * generator gives the same field in both passes — the same trick HeroScene uses
 * for its per-coin spin rates, and for the same reason.
 *
 * Positions are PERCENTAGES and radii are pixels, so the field reflows with the
 * card at any width without stretching the stars into ellipses — which is what
 * a viewBox with preserveAspectRatio="none" would have done.
 */

import type { CSSProperties, FC } from "react";

/** Stars across the whole card. Enough to read as a field, few enough to stay
 *  behind the copy rather than competing with it. */
const STAR_COUNT = 110;

/** mulberry32: small, fast, and stable across server and client. */
const seeded = (seed: number) => () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

interface Star {
  x: number;
  y: number;
  r: number;
  o: number;
  /** Seconds. 0 means this one does not twinkle at all. */
  duration: number;
  delay: number;
}

/**
 * Built once at module scope: the field is fixed, so there is no reason to
 * regenerate it per render or per mount.
 */
const STARS: Star[] = (() => {
  const rand = seeded(0x5eed);

  return Array.from({ length: STAR_COUNT }, (): Star => {
    const bright = rand();

    /*
      Sizes and opacities are spread on a CURVE rather than uniformly. A field
      of evenly-weighted dots reads as noise or as a texture swatch; a real sky
      is mostly faint pinpricks with a few brighter ones, so `bright` is cubed
      to keep the bright tail rare.
    */
    const weight = bright * bright * bright;

    return {
      x: rand() * 100,
      y: rand() * 100,
      r: 0.5 + weight * 1.15,
      o: 0.18 + weight * 0.62,
      // Two thirds hold steady. If everything twinkles, the whole card
      // shimmers and stops reading as a sky.
      duration: rand() < 0.34 ? 3.5 + rand() * 4.5 : 0,
      delay: rand() * 6,
    };
  });
})();

const Starfield: FC = () => (
  /*
    Masked, not evenly spread.

    The copy sits dead centre, and stars crossing the paragraph are the one
    thing that would make this less legible than the plain card it replaces. The
    mask thins the field to a quarter of its opacity behind the text and lets it
    come up to full strength towards the edges, which also gives the card a bit
    of depth rather than a flat sprinkle.
  */
  <div
    className="pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_62%_58%_at_50%_50%,rgba(0,0,0,0.22),#000_72%)] [-webkit-mask-image:radial-gradient(ellipse_62%_58%_at_50%_50%,rgba(0,0,0,0.22),#000_72%)]"
    aria-hidden
  >
    <svg className="h-full w-full" xmlns="http://www.w3.org/2000/svg">
      {STARS.map((star, i) => (
        <circle
          key={i}
          cx={`${star.x}%`}
          cy={`${star.y}%`}
          r={star.r}
          fill="#fff"
          /*
            Base opacity rides on a custom property so the keyframes can dip to
            a FRACTION of it. Hard-coding the animation to fixed opacities would
            flatten every star to the same brightness at the bottom of its
            cycle, undoing the weighting above.
          */
          className={star.duration ? "animate-twinkle" : undefined}
          style={
            {
              "--star-o": star.o,
              opacity: star.o,
              animationDuration: star.duration ? `${star.duration}s` : undefined,
              animationDelay: star.duration ? `${star.delay}s` : undefined,
            } as CSSProperties
          }
        />
      ))}
    </svg>
  </div>
);

export default Starfield;
