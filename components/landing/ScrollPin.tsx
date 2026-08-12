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
 */

import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
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
}

const ScrollPin = ({ children, className = "", sceneClassName = "" }: ScrollPinProps) => {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const listeners = useRef<Set<Listener>>(new Set());
  const progress = useRef(0);

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

  useIsomorphicLayoutEffect(() => {
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

      if (next === progress.current) return;

      progress.current = next;
      listeners.current.forEach((listener) => listener(next));
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
  }, []);

  return (
    <PinContext.Provider value={api}>
      <div ref={wrapperRef} className={className}>
        <div className={"sticky top-0 " + sceneClassName}>{children}</div>
      </div>
    </PinContext.Provider>
  );
};

export default ScrollPin;
