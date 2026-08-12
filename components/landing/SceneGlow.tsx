/**
 * SceneGlow.tsx
 * ---------------------------------------------------------------------------
 * The soft radial wash sitting where the orbit sits.
 *
 * It covers three different states with one element, which is the point of it
 * being a single component rather than a loading graphic and a separate
 * background:
 *
 *   1. While the ~450 KB three.js chunk downloads, this IS the hero background
 *      (next/dynamic renders it as the loading state).
 *   2. Once HeroScene mounts, the same wash sits under the canvas as ambient
 *      light, and the coins fade up over it.
 *   3. If WebGL is unavailable or the context is lost, it is what remains.
 *
 * Because all three render the identical element, the handoff between them is
 * invisible: nothing moves, nothing changes brightness, and the only event a
 * reader ever sees is the coins arriving. It deliberately does NOT pulse or
 * animate. An earlier version pulsed to signal loading, which meant the moment
 * the chunk landed the throb stopped dead — announcing the swap that this is
 * supposed to hide.
 *
 * No "use client": both callers are already client components.
 */

import type { FC } from "react";

const SceneGlow: FC = () => (
  <div className="absolute inset-0 grid place-items-center" aria-hidden>
    <div className="h-[38rem] w-[38rem] rounded-full bg-[radial-gradient(circle_at_50%_50%,rgba(232,232,236,0.14),rgba(148,152,162,0.07)_45%,transparent_72%)] blur-3xl" />
  </div>
);

export default SceneGlow;
