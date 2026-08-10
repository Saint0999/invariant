"use client";

/**
 * InvariantLanding.tsx
 * ---------------------------------------------------------------------------
 * A production-ready landing page for a crypto-to-crypto / crypto-to-fiat
 * converter platform.
 *
 * NEXT.JS (App Router) INTEGRATION
 * ---------------------------------------------------------------------------
 * 1. Install dependencies:
 *
 *      npm i three @react-three/fiber @react-three/drei lucide-react
 *      npm i -D @types/three
 *
 * 2. Drop this file at: components/landing/InvariantLanding.tsx
 *
 * 3. Use it from a server page — the "use client" directive above means this
 *    subtree hydrates on the client, while app/page.tsx stays a Server
 *    Component (so metadata / streaming still work):
 *
 *      // app/page.tsx
 *      import InvariantLanding from "@/components/landing/InvariantLanding";
 *
 *      export const metadata = {
 *        title: "Invariant — Instant crypto to fiat, any chain",
 *      };
 *
 *      export default function Page() {
 *        return <InvariantLanding />;
 *      }
 *
 * 4. Tailwind: no config changes are strictly required — every effect below is
 *    built from stock utilities plus arbitrary values. Two small animations are
 *    declared in the <style jsx global> block at the bottom of this file so the
 *    component stays fully self-contained. If you prefer them in
 *    tailwind.config.ts, move `@keyframes marquee` / `@keyframes floaty` into
 *    `theme.extend.keyframes` and delete the block.
 *
 * 5. Fonts (optional but recommended for the reference look) — in app/layout.tsx:
 *
 *      import { Inter } from "next/font/google";
 *      const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });
 *      // <body className={`${inter.variable} font-sans`}>
 *
 * NOTE ON THE 3D CANVAS
 * ---------------------------------------------------------------------------
 * three.js touches `window` during module evaluation in some builds, and the
 * WebGL canvas has nothing useful to say to a crawler. The scene is therefore
 * loaded via `next/dynamic` with `ssr: false` and a CSS-only glow placeholder,
 * which keeps the server render fast and the hero LCP text-first.
 */

import dynamic from "next/dynamic";
import { useCallback, useMemo, useRef, useState, type FC, type ReactNode } from "react";
import {
  ArrowRight,
  ArrowUpDown,
  BadgeCheck,
  BookOpen,
  ChevronDown,
  Coins,
  Gauge,
  Landmark,
  LineChart,
  Lock,
  Menu,
  ShieldCheck,
  Sparkles as SparklesIcon,
  X,
  Zap,
} from "lucide-react";

/* ==========================================================================
 * Types
 * ========================================================================== */

export interface NavLink {
  /** Visible label in the navbar. */
  label: string;
  /** Anchor or route. Use hashes for on-page sections, paths for routes. */
  href: string;
}

export interface TickerRate {
  /** Ticker symbol, e.g. "BTC". */
  symbol: string;
  /** Human-readable pair, e.g. "BTC / USD". */
  pair: string;
  /** Formatted price string — formatting is the caller's job so this stays pure. */
  price: string;
  /** Signed 24h change in percent. Positive renders emerald, negative rose. */
  change24h: number;
}

export interface TrustStat {
  label: string;
  value: string;
  icon: FC<{ className?: string }>;
}

export interface InvariantLandingProps {
  /** Product name rendered in the navbar and hero eyebrow. */
  brand?: string;
  /** Center navigation links. */
  navLinks?: NavLink[];
  /** Destination for the primary navbar button. */
  launchHref?: string;
  /** Label for the primary navbar button. */
  launchLabel?: string;
  /** Rates shown in the marquee + hero widget. Wire to your price feed. */
  rates?: TickerRate[];
  /** Trust badges under the hero CTAs. */
  stats?: TrustStat[];
  /** Fired when the user submits the hero quote widget. */
  onQuote?: (payload: { amount: string; from: string; to: string }) => void;
}

/* ==========================================================================
 * Defaults — replace with live data from your API / server component props
 * ========================================================================== */

const DEFAULT_NAV: NavLink[] = [
  { label: "Features", href: "#features" },
  { label: "Supported Currencies", href: "#currencies" },
  { label: "Security", href: "#security" },
  { label: "Docs", href: "#docs" },
];

const DEFAULT_RATES: TickerRate[] = [
  { symbol: "BTC", pair: "BTC / USD", price: "$67,412.08", change24h: 2.41 },
  { symbol: "ETH", pair: "ETH / USD", price: "$3,284.90", change24h: 1.08 },
  { symbol: "SOL", pair: "SOL / EUR", price: "€142.66", change24h: -0.73 },
  { symbol: "USDC", pair: "USDC / GBP", price: "£0.7912", change24h: 0.02 },
  { symbol: "AVAX", pair: "AVAX / USD", price: "$38.17", change24h: 4.65 },
  { symbol: "MATIC", pair: "MATIC / USD", price: "$0.8143", change24h: -1.24 },
  { symbol: "ARB", pair: "ARB / USD", price: "$1.1290", change24h: 3.02 },
];

const DEFAULT_STATS: TrustStat[] = [
  { label: "Median settlement", value: "18s", icon: Zap },
  { label: "Chains routed", value: "24", icon: Coins },
  { label: "Fiat rails", value: "51 countries", icon: Landmark },
  { label: "Proof-of-reserve", value: "Live", icon: ShieldCheck },
];

const CRYPTO_OPTIONS = ["BTC", "ETH", "SOL", "USDC", "USDT", "AVAX", "ARB"] as const;
const FIAT_OPTIONS = ["USD", "EUR", "GBP", "AED", "SGD", "JPY"] as const;

/* ==========================================================================
 * 3D scene — code-split, client-only
 * ========================================================================== */

const HeroScene = dynamic(() => import("./HeroScene"), {
  ssr: false,
  loading: () => <SceneFallback />,
});

/** CSS-only stand-in so the hero never reflows when the WebGL bundle lands. */
const SceneFallback: FC = () => (
  <div className="absolute inset-0 grid place-items-center" aria-hidden>
    <div className="h-64 w-64 animate-pulse rounded-full bg-[radial-gradient(circle_at_50%_50%,rgba(99,102,241,0.45),rgba(34,211,238,0.18)_45%,transparent_70%)] blur-2xl" />
  </div>
);

/* ==========================================================================
 * Small presentational primitives
 * ========================================================================== */

interface GlassProps {
  className?: string;
  children: ReactNode;
}

/**
 * The core glassmorphism surface used across the page: translucent fill,
 * backdrop blur, a hairline top highlight, and a soft outer glow.
 */
const GlassPanel: FC<GlassProps> = ({ className = "", children }) => (
  <div
    className={
      "relative rounded-3xl border border-white/10 bg-white/[0.04] shadow-[0_8px_40px_-12px_rgba(0,0,0,0.8)] backdrop-blur-xl " +
      "before:pointer-events-none before:absolute before:inset-x-6 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-white/40 before:to-transparent " +
      className
    }
  >
    {children}
  </div>
);

interface PillProps {
  children: ReactNode;
  className?: string;
}

const Pill: FC<PillProps> = ({ children, className = "" }) => (
  <span
    className={
      "inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.05] px-3.5 py-1.5 text-xs font-medium tracking-wide text-white/70 backdrop-blur-md " +
      className
    }
  >
    {children}
  </span>
);

/* ==========================================================================
 * Header / Navbar
 * ========================================================================== */

interface NavbarProps {
  brand: string;
  links: NavLink[];
  launchHref: string;
  launchLabel: string;
}

const Navbar: FC<NavbarProps> = ({ brand, links, launchHref, launchLabel }) => {
  const [open, setOpen] = useState<boolean>(false);

  return (
    <header className="fixed inset-x-0 top-0 z-50">
      <div className="mx-auto mt-4 w-[min(1200px,calc(100%-2rem))]">
        <GlassPanel className="rounded-2xl px-4 py-3 sm:px-5">
          <nav className="flex items-center justify-between gap-6" aria-label="Main">
            {/* ---- Brand ------------------------------------------------- */}
            <a href="/" className="group flex items-center gap-3">
              <span className="relative grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-cyan-300 via-indigo-400 to-fuchsia-500 shadow-[0_0_24px_-4px_rgba(129,140,248,0.9)]">
                <ArrowUpDown className="h-4 w-4 text-[#0B0E14]" strokeWidth={2.75} />
              </span>
              <span className="flex flex-col leading-none">
                <span className="text-[15px] font-semibold tracking-tight text-white">{brand}</span>
                {/* Hidden on the narrowest screens — at 390px it wraps to
                    three lines and shoves the CTA into a two-line button. */}
                <span className="mt-0.5 hidden text-[10px] uppercase tracking-[0.18em] text-white/40 sm:block">
                  Convert · Bridge · Cash out
                </span>
              </span>
            </a>

            {/* ---- Center links (desktop) -------------------------------- */}
            <ul className="hidden items-center gap-1 lg:flex">
              {links.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    className="relative rounded-full px-4 py-2 text-sm text-white/65 transition-colors duration-200 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60"
                  >
                    <span className="absolute inset-0 rounded-full bg-white/0 transition-colors duration-200 hover:bg-white/[0.06]" />
                    <span className="relative">{link.label}</span>
                  </a>
                </li>
              ))}
            </ul>

            {/* ---- Actions ----------------------------------------------- */}
            <div className="flex items-center gap-2">
              <a
                href="/login"
                className="hidden rounded-full px-4 py-2 text-sm text-white/60 transition-colors hover:text-white sm:block"
              >
                Log in
              </a>

              <a
                href={launchHref}
                className="group relative inline-flex items-center gap-2 overflow-hidden whitespace-nowrap rounded-full bg-white px-4 py-2.5 text-sm font-semibold text-[#0B0E14] transition-transform duration-200 hover:scale-[1.03] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 sm:px-5"
              >
                {/* Sheen sweep on hover */}
                <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-cyan-200/70 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
                {/* Short label on phones so the button stays one line. */}
                <span className="relative sm:hidden">Launch</span>
                <span className="relative hidden sm:inline">{launchLabel}</span>
                <ArrowRight className="relative h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
              </a>

              <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                aria-expanded={open}
                aria-label={open ? "Close navigation" : "Open navigation"}
                className="grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-white/[0.04] text-white/80 lg:hidden"
              >
                {open ? <X className="h-4.5 w-4.5" /> : <Menu className="h-4.5 w-4.5" />}
              </button>
            </div>
          </nav>

          {/* ---- Mobile drawer ------------------------------------------- */}
          {open && (
            <ul className="mt-3 grid gap-1 border-t border-white/10 pt-3 lg:hidden">
              {links.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    onClick={() => setOpen(false)}
                    className="block rounded-xl px-4 py-2.5 text-sm text-white/70 transition-colors hover:bg-white/[0.06] hover:text-white"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </GlassPanel>
      </div>
    </header>
  );
};

/* ==========================================================================
 * Hero quote widget — the conversion surface, inline in the hero
 * ========================================================================== */

interface QuoteWidgetProps {
  rates: TickerRate[];
  onQuote?: InvariantLandingProps["onQuote"];
}

const QuoteWidget: FC<QuoteWidgetProps> = ({ rates, onQuote }) => {
  const [amount, setAmount] = useState<string>("1.00");
  const [from, setFrom] = useState<string>("ETH");
  const [to, setTo] = useState<string>("USD");
  const inputRef = useRef<HTMLInputElement>(null);

  /**
   * Indicative output. This is intentionally a naive local estimate so the
   * component has zero network dependencies — swap `estimate` for your quote
   * endpoint (and debounce it) when you wire up the real router.
   */
  const estimate = useMemo<string>(() => {
    const numeric = Number.parseFloat(amount.replace(/,/g, ""));
    if (!Number.isFinite(numeric) || numeric <= 0) return "—";

    const match = rates.find((r) => r.symbol === from);
    const unit = match ? Number.parseFloat(match.price.replace(/[^0-9.]/g, "")) : 0;
    if (!unit) return "—";

    return (numeric * unit).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }, [amount, from, rates]);

  const swapDirection = useCallback(() => {
    // Crypto→fiat is one-way in this demo, so "swap" re-targets the fiat leg
    // and returns focus to the amount field for fast repeat quoting.
    setTo((current) => {
      const idx = FIAT_OPTIONS.indexOf(current as (typeof FIAT_OPTIONS)[number]);
      return FIAT_OPTIONS[(idx + 1) % FIAT_OPTIONS.length];
    });
    inputRef.current?.focus();
  }, []);

  return (
    <GlassPanel className="w-full max-w-md p-5">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-white/45">
          Instant quote
        </p>
        <Pill className="!px-2.5 !py-1 !text-[10px]">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
          Live routing
        </Pill>
      </div>

      {/* ---- You send ------------------------------------------------- */}
      <label className="mt-4 block rounded-2xl border border-white/10 bg-black/30 p-4 transition-colors focus-within:border-cyan-300/50">
        <span className="text-[11px] uppercase tracking-wider text-white/40">You send</span>
        <div className="mt-2 flex items-center gap-3">
          <input
            ref={inputRef}
            value={amount}
            inputMode="decimal"
            onChange={(e) => setAmount(e.target.value)}
            aria-label="Amount to convert"
            className="w-full bg-transparent text-2xl font-semibold tracking-tight text-white outline-none placeholder:text-white/25"
            placeholder="0.00"
          />
          <SelectChip value={from} onChange={setFrom} options={CRYPTO_OPTIONS as readonly string[]} />
        </div>
      </label>

      {/* ---- Direction toggle ------------------------------------------ */}
      <div className="relative -my-2.5 grid place-items-center">
        <button
          type="button"
          onClick={swapDirection}
          aria-label="Change payout currency"
          className="z-10 grid h-9 w-9 place-items-center rounded-full border border-white/15 bg-[#0B0E14] text-white/80 shadow-[0_0_20px_-4px_rgba(34,211,238,0.7)] transition-transform duration-200 hover:rotate-180 hover:text-cyan-300"
        >
          <ArrowUpDown className="h-4 w-4" />
        </button>
      </div>

      {/* ---- You receive ----------------------------------------------- */}
      <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
        <span className="text-[11px] uppercase tracking-wider text-white/40">You receive</span>
        <div className="mt-2 flex items-center gap-3">
          <output className="w-full truncate text-2xl font-semibold tracking-tight text-white/90">
            {estimate}
          </output>
          <SelectChip value={to} onChange={setTo} options={FIAT_OPTIONS as readonly string[]} />
        </div>
      </div>

      <button
        type="button"
        onClick={() => onQuote?.({ amount, from, to })}
        className="group mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-300 via-indigo-400 to-fuchsia-500 px-5 py-3.5 text-sm font-semibold text-[#0B0E14] shadow-[0_10px_40px_-12px_rgba(99,102,241,0.9)] transition-transform duration-200 hover:scale-[1.02] active:scale-[0.99]"
      >
        Convert Now
        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
      </button>

      <p className="mt-3 flex items-center justify-center gap-1.5 text-[11px] text-white/35">
        <Lock className="h-3 w-3" />
        Rate locked for 30s · no custody of your keys
      </p>
    </GlassPanel>
  );
};

interface SelectChipProps {
  value: string;
  onChange: (next: string) => void;
  options: readonly string[];
}

/** Native <select> styled as a glass chip — keyboard + mobile friendly. */
const SelectChip: FC<SelectChipProps> = ({ value, onChange, options }) => (
  <div className="relative shrink-0">
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="appearance-none rounded-full border border-white/12 bg-white/[0.06] py-2 pl-4 pr-9 text-sm font-semibold text-white outline-none transition-colors hover:bg-white/[0.1] focus-visible:ring-2 focus-visible:ring-cyan-300/60"
    >
      {options.map((opt) => (
        <option key={opt} value={opt} className="bg-[#0B0E14] text-white">
          {opt}
        </option>
      ))}
    </select>
    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/50" />
  </div>
);

/* ==========================================================================
 * Live rates marquee
 * ========================================================================== */

const RatesMarquee: FC<{ rates: TickerRate[] }> = ({ rates }) => {
  // Duplicated once so the CSS translate loop is seamless.
  const loop = [...rates, ...rates];

  return (
    <div
      className="relative mt-10 overflow-hidden border-y sm:mt-16 border-white/[0.07] bg-white/[0.02] py-4 backdrop-blur-sm"
      aria-hidden
    >
      {/* Edge fades so items dissolve rather than clip */}
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-24 bg-gradient-to-r from-[#0B0E14] to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-24 bg-gradient-to-l from-[#0B0E14] to-transparent" />

      <div className="flex w-max animate-[marquee_38s_linear_infinite] gap-10 pr-10 hover:[animation-play-state:paused]">
        {loop.map((rate, i) => (
          <div key={`${rate.symbol}-${i}`} className="flex items-center gap-3 whitespace-nowrap">
            <span className="grid h-7 w-7 place-items-center rounded-full border border-white/10 bg-white/[0.05] text-[10px] font-bold text-white/70">
              {rate.symbol.slice(0, 3)}
            </span>
            <span className="text-sm text-white/50">{rate.pair}</span>
            <span className="text-sm font-semibold text-white">{rate.price}</span>
            <span
              className={
                "text-xs font-medium " +
                (rate.change24h >= 0 ? "text-emerald-400" : "text-rose-400")
              }
            >
              {rate.change24h >= 0 ? "+" : ""}
              {rate.change24h.toFixed(2)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

/* ==========================================================================
 * Hero
 * ========================================================================== */

interface HeroProps {
  brand: string;
  rates: TickerRate[];
  stats: TrustStat[];
  launchHref: string;
  onQuote?: InvariantLandingProps["onQuote"];
}

const Hero: FC<HeroProps> = ({ brand, rates, stats, launchHref, onQuote }) => (
  <section className="relative isolate overflow-hidden pt-36 sm:pt-44">
    {/* ---- Ambient background layers (all pointer-events-none) --------- */}
    <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden>
      {/* Radiant top-center bloom */}
      <div className="absolute left-1/2 top-[-18rem] h-[36rem] w-[64rem] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse_at_center,rgba(79,70,229,0.35),rgba(34,211,238,0.16)_40%,transparent_70%)] blur-3xl" />
      {/* Warm counter-glow, echoing the amber reference */}
      <div className="absolute -right-40 top-40 h-[28rem] w-[28rem] rounded-full bg-[radial-gradient(circle,rgba(251,146,60,0.18),transparent_65%)] blur-3xl" />
      {/* Grid floor */}
      <div className="absolute inset-x-0 bottom-0 h-[42rem] bg-[linear-gradient(to_right,rgba(255,255,255,0.045)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.045)_1px,transparent_1px)] bg-[size:56px_56px] [mask-image:radial-gradient(ellipse_at_50%_0%,black,transparent_72%)]" />
      {/* Fine mesh noise — inlined SVG turbulence, no asset request */}
      <div
        className="absolute inset-0 opacity-[0.14] mix-blend-soft-light"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />
    </div>

    <div className="mx-auto grid w-[min(1200px,calc(100%-2rem))] items-center gap-14 lg:grid-cols-[1.05fr_0.95fr]">
      {/* ---- Copy column ---------------------------------------------- */}
      <div className="relative z-10">
        <Pill>
          <SparklesIcon className="h-3.5 w-3.5 text-cyan-300" />
          {brand} · 24 chains, one settlement layer
        </Pill>

        <h1 className="mt-6 text-balance text-5xl font-semibold leading-[1.03] tracking-[-0.03em] text-white sm:text-6xl xl:text-7xl">
          Turn any token into{" "}
          <span className="bg-gradient-to-r from-cyan-200 via-indigo-300 to-fuchsia-400 bg-clip-text text-transparent">
            spendable money
          </span>{" "}
          in seconds.
        </h1>

        <p className="mt-6 max-w-xl text-pretty text-base leading-relaxed text-white/55 sm:text-lg">
          Cross-chain swaps and crypto-to-fiat payouts on one route. We quote across 40+
          liquidity venues, lock your rate before you sign, and settle straight to your bank
          — non-custodial from the first block to the last.
        </p>

        {/* ---- CTAs ---------------------------------------------------- */}
        <div className="mt-9 flex flex-wrap items-center gap-3">
          <a
            href={launchHref}
            className="group relative inline-flex items-center gap-2 overflow-hidden rounded-full bg-white px-7 py-3.5 text-sm font-semibold text-[#0B0E14] shadow-[0_12px_50px_-14px_rgba(255,255,255,0.6)] transition-transform duration-200 hover:scale-[1.03] active:scale-[0.98]"
          >
            <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-cyan-200/60 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
            <span className="relative">Convert Now</span>
            <ArrowRight className="relative h-4 w-4 transition-transform group-hover:translate-x-1" />
          </a>

          <a
            href="#rates"
            className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.04] px-7 py-3.5 text-sm font-semibold text-white/85 backdrop-blur-md transition-colors hover:border-cyan-300/40 hover:bg-white/[0.08] hover:text-white"
          >
            <LineChart className="h-4 w-4 text-cyan-300" />
            View Live Rates
          </a>
        </div>

        {/* ---- Trust strip --------------------------------------------- */}
        <dl className="mt-12 grid max-w-xl grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4">
          {stats.map(({ label, value, icon: Icon }) => (
            <div key={label} className="border-l border-white/10 pl-4">
              <dt className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-white/40">
                <Icon className="h-3.5 w-3.5 text-white/35" />
                {label}
              </dt>
              <dd className="mt-1 text-lg font-semibold tracking-tight text-white">{value}</dd>
            </div>
          ))}
        </dl>
      </div>

      {/* ---- 3D + widget column ---------------------------------------- */}
      {/* The tall min-height exists to give the canvas room to bleed on
          desktop; on phones that would just be dead space under the widget. */}
      <div className="relative min-h-[430px] lg:min-h-[560px]">
        {/* The canvas sits behind the widget and bleeds past the column on
            large screens, mirroring the depth of the reference layouts. */}
        <div className="absolute inset-0 lg:-inset-x-24 lg:-inset-y-16">
          <HeroScene />
        </div>

        <div className="relative flex h-full items-center justify-center lg:justify-end">
          <div className="animate-[floaty_9s_ease-in-out_infinite]">
            <QuoteWidget rates={rates} onQuote={onQuote} />
          </div>
        </div>
      </div>
    </div>

    <div id="rates">
      <RatesMarquee rates={rates} />
    </div>
  </section>
);

/* ==========================================================================
 * Supporting sections (kept lean — the hero is the conversion surface)
 * ========================================================================== */

interface Feature {
  title: string;
  body: string;
  icon: FC<{ className?: string }>;
}

const FEATURES: Feature[] = [
  {
    title: "One route, any chain",
    body: "Bridge and swap collapse into a single signed intent. No manual hops, no stranded gas on a chain you'll never use again.",
    icon: Coins,
  },
  {
    title: "Rate locked before you sign",
    body: "We hold the quote for 30 seconds and absorb the slippage. What the widget shows is what lands in your account.",
    icon: Gauge,
  },
  {
    title: "Fiat out in 51 countries",
    body: "SEPA, FPS, ACH and local rails, settled from the same transaction that closed your swap.",
    icon: Landmark,
  },
  {
    title: "Non-custodial by construction",
    body: "Keys never leave your wallet. Contracts are audited, verified on-chain, and reserves are attested continuously.",
    icon: ShieldCheck,
  },
];

const FeatureGrid: FC = () => (
  <section id="features" className="relative mx-auto mt-28 w-[min(1200px,calc(100%-2rem))]">
    <div className="max-w-2xl">
      <Pill>
        <BadgeCheck className="h-3.5 w-3.5 text-cyan-300" />
        Why it converts
      </Pill>
      <h2 className="mt-5 text-balance text-4xl font-semibold tracking-[-0.02em] text-white sm:text-5xl">
        Built for the moment you actually need the money.
      </h2>
    </div>

    <div className="mt-12 grid gap-4 sm:grid-cols-2">
      {FEATURES.map(({ title, body, icon: Icon }) => (
        <GlassPanel
          key={title}
          className="group p-7 transition-colors duration-300 hover:border-cyan-300/25 hover:bg-white/[0.06]"
        >
          <span className="grid h-11 w-11 place-items-center rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.12] to-white/[0.02] text-cyan-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.15)]">
            <Icon className="h-5 w-5" />
          </span>
          <h3 className="mt-5 text-lg font-semibold tracking-tight text-white">{title}</h3>
          <p className="mt-2 text-sm leading-relaxed text-white/50">{body}</p>
        </GlassPanel>
      ))}
    </div>
  </section>
);

const ClosingCta: FC<{ launchHref: string; launchLabel: string }> = ({
  launchHref,
  launchLabel,
}) => (
  <section id="docs" className="mx-auto my-28 w-[min(1200px,calc(100%-2rem))]">
    <GlassPanel className="overflow-hidden px-8 py-16 text-center sm:px-16">
      <div
        className="pointer-events-none absolute left-1/2 top-0 h-72 w-[40rem] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse_at_center,rgba(99,102,241,0.35),transparent_70%)] blur-3xl"
        aria-hidden
      />
      <h2 className="relative text-balance text-4xl font-semibold tracking-[-0.02em] text-white sm:text-5xl">
        Your first conversion takes under a minute.
      </h2>
      <p className="relative mx-auto mt-4 max-w-lg text-white/50">
        Connect a wallet, pick a payout account, and watch the quote settle. No signup wall,
        no minimums.
      </p>
      <div className="relative mt-9 flex flex-wrap justify-center gap-3">
        <a
          href={launchHref}
          className="inline-flex items-center gap-2 rounded-full bg-white px-7 py-3.5 text-sm font-semibold text-[#0B0E14] transition-transform hover:scale-[1.03]"
        >
          {launchLabel}
          <ArrowRight className="h-4 w-4" />
        </a>
        <a
          href="/docs"
          className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.04] px-7 py-3.5 text-sm font-semibold text-white/85 transition-colors hover:bg-white/[0.08]"
        >
          <BookOpen className="h-4 w-4 text-cyan-300" />
          Read the docs
        </a>
      </div>
    </GlassPanel>
  </section>
);

/* ==========================================================================
 * Page shell
 * ========================================================================== */

const InvariantLanding: FC<InvariantLandingProps> = ({
  brand = "Invariant",
  navLinks = DEFAULT_NAV,
  launchHref = "/convert",
  launchLabel = "Launch Converter",
  rates = DEFAULT_RATES,
  stats = DEFAULT_STATS,
  onQuote,
}) => (
  <div className="relative min-h-screen bg-[#0B0E14] font-sans antialiased selection:bg-cyan-300/30">
    <Navbar brand={brand} links={navLinks} launchHref={launchHref} launchLabel={launchLabel} />

    <main>
      <Hero
        brand={brand}
        rates={rates}
        stats={stats}
        launchHref={launchHref}
        onQuote={onQuote}
      />
      <FeatureGrid />
      <ClosingCta launchHref={launchHref} launchLabel={launchLabel} />
    </main>

    <footer id="security" className="border-t border-white/[0.07] py-10">
      <div className="mx-auto flex w-[min(1200px,calc(100%-2rem))] flex-col items-center justify-between gap-4 text-sm text-white/35 sm:flex-row">
        <span>
          © {new Date().getFullYear()} {brand} Labs. Non-custodial. Audited.
        </span>
        <div className="flex gap-6">
          <a href="/terms" className="transition-colors hover:text-white/70">
            Terms
          </a>
          <a href="/privacy" className="transition-colors hover:text-white/70">
            Privacy
          </a>
          <a href="/status" className="transition-colors hover:text-white/70">
            Status
          </a>
        </div>
      </div>
    </footer>

    {/* Self-contained keyframes. Move to tailwind.config.ts if you prefer. */}
    <style jsx global>{`
      @keyframes marquee {
        from {
          transform: translateX(0);
        }
        to {
          transform: translateX(-50%);
        }
      }
      @keyframes floaty {
        0%,
        100% {
          transform: translateY(0);
        }
        50% {
          transform: translateY(-12px);
        }
      }
      @media (prefers-reduced-motion: reduce) {
        .animate-\\[marquee_38s_linear_infinite\\],
        .animate-\\[floaty_9s_ease-in-out_infinite\\] {
          animation: none !important;
        }
      }
    `}</style>
  </div>
);

export default InvariantLanding;
