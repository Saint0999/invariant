"use client";

/**
 * GradualBlur.tsx
 * ---------------------------------------------------------------------------
 * A progressive blur that ramps up towards one edge of the viewport (or of its
 * parent), so content fades out under it instead of being cut off by a hard
 * gradient.
 *
 * Adapted from React Bits "Gradual Blur" (https://reactbits.dev/animations/gradual-blur,
 * MIT, github.com/DavidHDev/react-bits), TS + Tailwind variant. The technique is
 * a stack of absolutely-positioned layers, each with a stronger `backdrop-filter`
 * and a `mask-image` that limits it to a narrow band — the bands overlap, so the
 * blur strength reads as continuous rather than as N discrete steps.
 *
 * NOTE ON `position: "bottom"` + `target: "page"`
 * ---------------------------------------------------------------------------
 * With target="page" the container is `fixed`, so it must NOT be nested inside
 * an ancestor that creates a containing block for fixed elements (a `transform`,
 * `filter`, `perspective`, `backdrop-filter`, `contain` or `will-change` on any
 * ancestor will do it) — otherwise it anchors to that ancestor, not the viewport.
 * See where it is mounted in InvariantLanding.
 *
 * `backdrop-filter` needs something behind it to blur; on this page that is the
 * charcoal gradient and the ambient washes, which is enough to read.
 */

import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PropsWithChildren,
  type RefObject,
} from "react";

/* ==========================================================================
 * Types
 * ========================================================================== */

export type GradualBlurProps = PropsWithChildren<{
  position?: "top" | "bottom" | "left" | "right";
  /** Multiplier on the blur radius of every layer. */
  strength?: number;
  height?: string;
  width?: string;
  /** Number of stacked layers. More = smoother ramp, more compositing cost. */
  divCount?: number;
  /** Ramp blur exponentially rather than linearly. */
  exponential?: boolean;
  zIndex?: number;
  /** `true` transitions on hover/prop change; `"scroll"` fades in when visible. */
  animated?: boolean | "scroll";
  duration?: string;
  easing?: string;
  opacity?: number;
  curve?: "linear" | "bezier" | "ease-in" | "ease-out" | "ease-in-out";
  responsive?: boolean;
  mobileHeight?: string;
  tabletHeight?: string;
  desktopHeight?: string;
  mobileWidth?: string;
  tabletWidth?: string;
  desktopWidth?: string;
  preset?: keyof typeof PRESETS;
  /** Multiplies `strength` while hovered. Setting this enables pointer events. */
  hoverIntensity?: number;
  /** `"parent"` → absolute inside the nearest positioned ancestor; `"page"` → fixed to the viewport. */
  target?: "parent" | "page";
  onAnimationComplete?: () => void;
  className?: string;
  style?: CSSProperties;
}>;

/* ==========================================================================
 * Config
 * ========================================================================== */

const DEFAULT_CONFIG = {
  position: "bottom",
  strength: 2,
  height: "6rem",
  divCount: 5,
  exponential: false,
  zIndex: 1000,
  animated: false,
  duration: "0.3s",
  easing: "ease-out",
  opacity: 1,
  curve: "linear",
  responsive: false,
  target: "parent",
  className: "",
  style: {},
} satisfies Partial<GradualBlurProps>;

const PRESETS = {
  top: { position: "top", height: "6rem" },
  bottom: { position: "bottom", height: "6rem" },
  left: { position: "left", height: "6rem" },
  right: { position: "right", height: "6rem" },

  subtle: { height: "4rem", strength: 1, opacity: 0.8, divCount: 3 },
  intense: { height: "10rem", strength: 4, divCount: 8, exponential: true },

  smooth: { height: "8rem", curve: "bezier", divCount: 10 },
  sharp: { height: "5rem", curve: "linear", divCount: 4 },

  header: { position: "top", height: "8rem", curve: "ease-out" },
  footer: { position: "bottom", height: "8rem", curve: "ease-out" },
  sidebar: { position: "left", height: "6rem", strength: 2.5 },

  "page-header": { position: "top", height: "10rem", target: "page", strength: 3 },
  "page-footer": { position: "bottom", height: "10rem", target: "page", strength: 3 },
} satisfies Record<string, Partial<GradualBlurProps>>;

/** Maps 0→1 across the stack onto a blur ramp shape. */
const CURVE_FUNCTIONS: Record<string, (p: number) => number> = {
  linear: p => p,
  bezier: p => p * p * (3 - 2 * p),
  "ease-in": p => p * p,
  "ease-out": p => 1 - Math.pow(1 - p, 2),
  "ease-in-out": p => (p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2),
};

const GRADIENT_DIRECTIONS: Record<string, string> = {
  top: "to top",
  bottom: "to bottom",
  left: "to left",
  right: "to right",
};

/* ==========================================================================
 * Hooks
 * ========================================================================== */

const debounce = <T extends (...a: never[]) => void>(fn: T, wait: number) => {
  let t: ReturnType<typeof setTimeout>;
  return (...a: Parameters<T>) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...a), wait);
  };
};

/**
 * Picks `mobileHeight` / `tabletHeight` / `desktopHeight` (or the width
 * equivalents) off the config by viewport width. Pass-through when
 * `responsive` is false, so the common case costs nothing.
 */
const useResponsiveDimension = (
  responsive: boolean | undefined,
  config: Record<string, unknown>,
  key: "height" | "width",
) => {
  const [val, setVal] = useState<string | undefined>(config[key] as string | undefined);

  useEffect(() => {
    if (!responsive) return;

    const calc = () => {
      const w = window.innerWidth;
      const k = key.charAt(0).toUpperCase() + key.slice(1);
      let v = config[key] as string | undefined;
      if (w <= 480 && config["mobile" + k]) v = config["mobile" + k] as string;
      else if (w <= 768 && config["tablet" + k]) v = config["tablet" + k] as string;
      else if (w <= 1024 && config["desktop" + k]) v = config["desktop" + k] as string;
      setVal(v);
    };

    const deb = debounce(calc, 100);
    calc();
    window.addEventListener("resize", deb);
    return () => window.removeEventListener("resize", deb);
  }, [responsive, config, key]);

  return responsive ? val : (config[key] as string | undefined);
};

const useIntersectionObserver = (ref: RefObject<HTMLDivElement | null>, shouldObserve = false) => {
  const [isVisible, setIsVisible] = useState(!shouldObserve);

  useEffect(() => {
    if (!shouldObserve || !ref.current) return;
    const observer = new IntersectionObserver(([entry]) => setIsVisible(entry.isIntersecting), {
      threshold: 0.1,
    });
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [ref, shouldObserve]);

  return isVisible;
};

/* ==========================================================================
 * Component
 * ========================================================================== */

const GradualBlur: React.FC<GradualBlurProps> = props => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);

  const config = useMemo(() => {
    const preset = props.preset ? PRESETS[props.preset] : {};
    return { ...DEFAULT_CONFIG, ...preset, ...props } as Required<
      Omit<GradualBlurProps, "children" | "preset" | "onAnimationComplete" | "hoverIntensity">
    > &
      Partial<GradualBlurProps>;
  }, [props]);

  const responsiveHeight = useResponsiveDimension(config.responsive, config, "height");
  const responsiveWidth = useResponsiveDimension(config.responsive, config, "width");
  const isVisible = useIntersectionObserver(containerRef, config.animated === "scroll");

  /*
    One layer per step. Each gets a mask window that opens at the previous step
    and closes two steps later, so neighbouring layers overlap and the seams
    between blur radii disappear.
  */
  const blurDivs = useMemo(() => {
    const divs: React.ReactNode[] = [];
    const increment = 100 / config.divCount;
    const currentStrength =
      isHovered && config.hoverIntensity ? config.strength * config.hoverIntensity : config.strength;
    const curveFunc = CURVE_FUNCTIONS[config.curve] ?? CURVE_FUNCTIONS.linear;
    const direction = GRADIENT_DIRECTIONS[config.position] ?? "to bottom";

    for (let i = 1; i <= config.divCount; i++) {
      const progress = curveFunc(i / config.divCount);

      const blurValue = config.exponential
        ? Math.pow(2, progress * 4) * 0.0625 * currentStrength
        : 0.0625 * (progress * config.divCount + 1) * currentStrength;

      const p1 = Math.round((increment * i - increment) * 10) / 10;
      const p2 = Math.round(increment * i * 10) / 10;
      const p3 = Math.round((increment * i + increment) * 10) / 10;
      const p4 = Math.round((increment * i + increment * 2) * 10) / 10;

      let gradient = `transparent ${p1}%, black ${p2}%`;
      if (p3 <= 100) gradient += `, black ${p3}%`;
      if (p4 <= 100) gradient += `, transparent ${p4}%`;

      const mask = `linear-gradient(${direction}, ${gradient})`;

      divs.push(
        <div
          key={i}
          className="absolute inset-0"
          style={{
            maskImage: mask,
            WebkitMaskImage: mask,
            backdropFilter: `blur(${blurValue.toFixed(3)}rem)`,
            WebkitBackdropFilter: `blur(${blurValue.toFixed(3)}rem)`,
            opacity: config.opacity,
            transition:
              config.animated && config.animated !== "scroll"
                ? `backdrop-filter ${config.duration} ${config.easing}`
                : undefined,
          }}
        />,
      );
    }

    return divs;
  }, [config, isHovered]);

  const containerStyle: CSSProperties = useMemo(() => {
    const isVertical = config.position === "top" || config.position === "bottom";
    const isPageTarget = config.target === "page";

    const base: CSSProperties = {
      position: isPageTarget ? "fixed" : "absolute",
      pointerEvents: config.hoverIntensity ? "auto" : "none",
      opacity: isVisible ? 1 : 0,
      transition: config.animated ? `opacity ${config.duration} ${config.easing}` : undefined,
      zIndex: isPageTarget ? config.zIndex + 100 : config.zIndex,
      ...config.style,
    };

    if (isVertical) {
      base.height = responsiveHeight;
      base.width = responsiveWidth ?? "100%";
      base.left = 0;
      base.right = 0;
      base[config.position as "top" | "bottom"] = 0;
    } else {
      base.width = responsiveWidth ?? responsiveHeight;
      base.height = "100%";
      base.top = 0;
      base.bottom = 0;
      base[config.position as "left" | "right"] = 0;
    }

    return base;
  }, [config, responsiveHeight, responsiveWidth, isVisible]);

  const { animated, duration, onAnimationComplete, hoverIntensity } = config;
  useEffect(() => {
    if (isVisible && animated === "scroll" && onAnimationComplete) {
      const t = setTimeout(() => onAnimationComplete(), parseFloat(duration) * 1000);
      return () => clearTimeout(t);
    }
  }, [isVisible, animated, duration, onAnimationComplete]);

  return (
    <div
      ref={containerRef}
      className={`isolate ${config.className}`}
      style={containerStyle}
      aria-hidden
      onMouseEnter={hoverIntensity ? () => setIsHovered(true) : undefined}
      onMouseLeave={hoverIntensity ? () => setIsHovered(false) : undefined}
    >
      <div className="relative h-full w-full">{blurDivs}</div>
      {props.children && <div className="relative">{props.children}</div>}
    </div>
  );
};

export default React.memo(GradualBlur);
