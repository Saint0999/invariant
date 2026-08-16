"use client";

/**
 * ScrollPin.tsx
 * ---------------------------------------------------------------------------
 * Holds a scene still in the viewport while the page keeps scrolling, and
 * publishes how far through that hold the reader is (0 → 1) to anything below
 * it in the tree. ScrollTrigger's `pin`, in about sixty lines.
 *
 * A tall outer wrapper supplies the scroll distance; a `sticky top-0` child one
 * viewport high is what actually stays put. The reader scrolls
 * (wrapper height − 100vh) pixels while the scene appears frozen, which is the
 * budget the animations inside get to play out over. Make the wrapper taller
 * and everything inside slows down proportionally — that is the only knob.
 *
 * STICKY, NOT position: fixed. Sticky needs no measurement, no scroll handler
 * to place the scene, and cannot drift out of sync with the layout on resize.
 * The one thing it does need is that NO ancestor has `overflow` other than
 * visible — a single `overflow-hidden` anywhere up the tree silently turns
 * this back into a static block. That is why the clipping in this section
 * lives on the sticky child rather than on the wrapper.
 *
 * Progress is pushed to subscribers rather than held in state: at 60fps a
 * `useState` here would re-render the whole subtree on every frame, and the
 * consumers only ever want to write to `style`.
 *
 * ONE-TIME PIN
 * The hold itself is meant to be watched once, not re-frozen every time the
 * reader scrolls back through this stretch of the page. The first time
 * progress reaches 1, `settled` flips permanently: the tall wrapper collapses
 * to an ordinary one-screen block, the sticky hold drops, and scroll
 * measurement stops. See the settle effect and the compensation effect below
 * for how that collapse avoids visibly yanking the rest of the page.
 */

import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

const useIsomorphicLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

const clamp01 = (n: number): number => (n < 0 ? 0 : n > 1 ? 1 : n);

type Listener = (progress: number) => void;

export interface PinProgress {
  /** Calls back on every frame the pin advances. Returns an unsubscribe. */
  subscribe: (listener: Listener) => () => void;
  /** Progress right now, for a consumer's first paint. */
  current: () => number;
}

const PinContext = createContext<PinProgress | null>(null);

/** Null outside a <ScrollPin>, which lets consumers keep a standalone mode. */
export const usePinProgress = (): PinProgress | null => useContext(PinContext);

export interface ScrollPinProps {
  children: ReactNode;
  /** Classes for the tall outer wrapper — put the section's height here. */
  className?: string;
  /** Classes for the sticky, one-viewport-high scene. */
  sceneClassName?: string;
  /**
   * Fires once, the moment progress first reaches 1 — the pin is about to
   * release for good. `usePinProgress`'s `current()` already reports this to
   * anything inside the pin; this is for a consumer OUTSIDE it, like the
   * landing page's `#currencies` anchor, which sits beside `<ScrollPin>` as a
   * sibling rather than a descendant and so cannot read its context.
   */
  onSettle?: () => void;
}

const ScrollPin = ({ children, className = "", sceneClassName = "", onSettle }: ScrollPinProps) => {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const listeners = useRef<Set<Listener>>(new Set());
  const progress = useRef(0);

  /*
    RELEASING FOR GOOD, NOT JUST HOLDING STILL AT THE END.

    Reaching progress 1 already means the reader has watched the pinned
    sequence resolve in full — ScrollFloat itself now latches there and stops
    re-animating on a later pass, but the SCROLL still froze the viewport for
    the whole (wrapper height − 100vh) climb to get there, every single time
    the reader re-entered this stretch of the page. That is the part still
    worth fixing: once the sequence has been seen once, the tall pinning
    wrapper collapses to one ordinary screen and the sticky hold is dropped,
    so scrolling back through here a second time just scrolls past it like any
    other section instead of freezing again.
  */
  const [settled, setSettled] = useState(false);
  const hasCompletedRef = useRef(false);
  /** The wrapper's height the instant before it collapses — see the
   *  compensation effect below for why this has to be captured here. */
  const heightBeforeSettleRef = useRef(0);
  /** Read via a ref so the scroll handler always calls the latest `onSettle`
   *  without needing it in that effect's dependency array. */
  const onSettleRef = useRef(onSettle);
  onSettleRef.current = onSettle;

  const api = useMemo<PinProgress>(
    () => ({
      subscribe: (listener) => {
        listeners.current.add(listener);
        listener(progress.current);
        return () => {
          listeners.current.delete(listener);
        };
      },
      current: () => progress.current,
    }),
    [],
  );

  // Measures scroll progress while the pin is still live. Never runs again
  // once settled — there is nothing left to measure once the wrapper has
  // collapsed to an ordinary block with no travel budget of its own.
  useIsomorphicLayoutEffect(() => {
    if (settled) return;

    const el = wrapperRef.current;
    if (!el) return;

    let frame = 0;

    const render = () => {
      frame = 0;

      const rect = el.getBoundingClientRect();
      /*
        Travel is the wrapper's height minus the one viewport the scene itself
        occupies. -rect.top is how far into the wrapper the viewport top has
        moved, so the ratio is 0 the moment the scene locks and 1 the moment it
        starts scrolling away again.
      */
      const travel = rect.height - window.innerHeight;
      const next = travel > 0 ? clamp01(-rect.top / travel) : rect.top <= 0 ? 1 : 0;

      if (next !== progress.current) {
        progress.current = next;
        listeners.current.forEach((listener) => listener(next));
      }

      /*
        This is the exact geometric moment sticky's own hold was always going
        to run out at anyway: the wrapper's bottom edge is precisely at the
        viewport's bottom edge, so the very next pixel of scroll starts moving
        the scene away like any ordinary element would. Settling here releases
        the reader at the natural end of the hold, never mid-way through it.
      */
      if (next >= 1 && !hasCompletedRef.current) {
        hasCompletedRef.current = true;
        heightBeforeSettleRef.current = el.getBoundingClientRect().height;
        setSettled(true);
        onSettleRef.current?.();
      }
    };

    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(render);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    render();

    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [settled]);

  /*
    Collapsing the tall wrapper shortens the document by exactly the travel
    distance the pin used to hold, and that yanks every pixel below it up by
    that same amount the instant the shorter wrapper commits — the reader
    would see whatever they were looking at leap up the screen. Pulling
    scrollY back by that already-known delta, synchronously and before the
    browser paints, is what keeps the swap invisible.

    The "before" height has to come from heightBeforeSettleRef, captured back
    in render() while the wrapper was still tall: by the time THIS effect
    runs, `settled` is already true and the DOM already reflects the
    collapsed wrapper, so measuring `el` here only ever sees the "after" side.
  */
  useIsomorphicLayoutEffect(() => {
    if (!settled) return;

    const el = wrapperRef.current;
    if (!el) return;

    const delta = heightBeforeSettleRef.current - el.getBoundingClientRect().height;
    if (delta > 0) window.scrollBy(0, -delta);
  }, [settled]);

  return (
    <PinContext.Provider value={api}>
      {/*
        overflow-anchor: none. Browser scroll anchoring exists to solve the
        exact same problem the effect above solves — it nudges scrollY on its
        own the instant content above the viewport resizes — by guessing which
        element to keep in place. The effect above does not need to guess: it
        knows the real delta. Leaving anchoring on risks it "helping" a second
        time on top of an already-exact correction, so this wrapper opts out
        and leaves the correction to the one that is actually precise.
      */}
      <div
        ref={wrapperRef}
        className={(settled ? undefined : className)}
        style={{ overflowAnchor: "none" }}
      >
        <div className={(settled ? "" : "sticky top-0 ") + sceneClassName}>{children}</div>
      </div>
    </PinContext.Provider>
  );
};

export default ScrollPin;
