"use client";

/**
 * InvariantLanding.tsx
 * ---------------------------------------------------------------------------
 * Landing page for a crypto-to-crypto / crypto-to-fiat converter platform.
 *
 * LIGHT THEME — the page sits on a soft radial gradient that is pure white at
 * the centre and falls off to a silver-grey at the edges, giving the surface
 * physical depth. Headline is a solid near-black (#111111). The 3D scene is a
 * full-bleed background layer behind centred content, masked so it never
 * competes with the type.
 *
 * NEXT.JS (App Router) INTEGRATION
 * ---------------------------------------------------------------------------
 * 1. npm i three @react-three/fiber @react-three/drei lucide-react
 *    npm i -D @types/three
 *
 * 2. Drop at: components/landing/InvariantLanding.tsx
 *
 * 3. // app/page.tsx  (stays a Server Component)
 *    import InvariantLanding from "@/components/landing/InvariantLanding";
 *    export default function Page() { return <InvariantLanding />; }
 *
 * 4. Give <body> the gradient's EDGE colour, not its centre, so overscroll and
 *    the area below the fold match instead of flashing white:
 *    <body className="bg-[#E4E7EC]">
 *
 * CHAIN LOGOS
 * ---------------------------------------------------------------------------
 * The supported-networks row reads SVGs from /public (/eth.svg, /sol.svg,
 * /base.svg, /arb.svg, /matic.svg). Placeholder files ship with this commit —
 * overwrite them with the real brand marks. See DEFAULT_NETWORKS.
 *
 * NOTE ON THE HEADER
 * ---------------------------------------------------------------------------
 * The navbar's structure, blur, hairline sheen, hover sweep and mobile drawer
 * are unchanged from the dark version. Only its colour tokens were inverted —
 * the original `bg-white/[0.04]` + `border-white/10` + white text is invisible
 * against a white page. Search "LIGHT-INVERTED" to find every changed token.
 */

import dynamic from "next/dynamic";
import Image from "next/image";
import { useState, type FC, type ReactNode } from "react";
import {
  ArrowRight,
  ArrowUpDown,
  BadgeCheck,
  BookOpen,
  Coins,
  Gauge,
  Landmark,
  Menu,
  ShieldCheck,
  X,
} from "lucide-react";

/* ==========================================================================
 * Types
 * ========================================================================== */

export interface NavLink {
  label: string;
  href: string;
}

export interface SupportedNetwork {
  /** Chain name shown in the hero's supported-networks row. */
  label: string;
  /** Path to the chain's logo under /public, e.g. "/eth.svg". */
  logo: string;
}

export interface InvariantLandingProps {
  /** Product name rendered in the navbar and footer. */
  brand?: string;
  /** Center navigation links. */
  navLinks?: NavLink[];
  /** Destination for the primary navbar button. */
  launchHref?: string;
  /** Label for the primary navbar button. */
  launchLabel?: string;
  /** Chains listed in the hero's supported-networks row. */
  networks?: SupportedNetwork[];
}

const DEFAULT_NAV: NavLink[] = [
  { label: "Features", href: "#features" },
  { label: "Currencies", href: "#currencies" },
  { label: "Security", href: "#security" },
  { label: "Docs", href: "#docs" },
];

/**
 * Chain marks are loaded from /public. The files shipped alongside this
 * component are neutral placeholders so the row renders instead of showing
 * broken images — drop your real brand SVGs over them at the same paths and
 * nothing here needs to change.
 */
const DEFAULT_NETWORKS: SupportedNetwork[] = [
  { label: "Ethereum", logo: "/eth.svg" },
  { label: "Solana", logo: "/sol.svg" },
  { label: "Base", logo: "/base.svg" },
  { label: "Arbitrum", logo: "/arb.svg" },
  { label: "Polygon", logo: "/matic.svg" },
];

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
    <div className="h-[32rem] w-[32rem] animate-pulse rounded-full bg-[radial-gradient(circle_at_50%_50%,rgba(15,23,42,0.06),transparent_70%)] blur-2xl" />
  </div>
);

/* ==========================================================================
 * Primitives
 * ========================================================================== */

interface GlassProps {
  className?: string;
  children: ReactNode;
}

/**
 * The frosted glass surface: a 40%-opacity white fill over `backdrop-blur-md`,
 * so whatever passes behind it blurs through rather than being blocked out.
 *
 * The previous version stacked an inner `ring-white/50` and a `border-white/60`
 * on top of the same fill — together those read as an almost-solid white edge
 * and made the whole bar look opaque, which is the bug this replaces. Only the
 * subtle bottom border remains.
 */
const GlassPanel: FC<GlassProps> = ({ className = "", children }) => (
  <div
    className={
      "relative rounded-3xl border-b border-white/20 bg-white/40 shadow-[0_8px_32px_-12px_rgba(15,23,42,0.15)] backdrop-blur-md backdrop-saturate-150 " +
      className
    }
  >
    {children}
  </div>
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
              {/* LIGHT-INVERTED: solid near-black mark instead of the gradient tile. */}
              <span className="relative grid h-9 w-9 place-items-center rounded-xl bg-[#111111]">
                <ArrowUpDown className="h-4 w-4 text-white" strokeWidth={2.75} />
              </span>
              {/* leading-none on the wrapper was what made these two lines feel
                  cramped; the gap now comes from an explicit mt on the tagline. */}
              <span className="flex flex-col leading-none">
                {/* LIGHT-INVERTED: text-white -> text-[#111111] */}
                <span className="text-[15px] font-semibold tracking-tight text-[#111111]">
                  {brand}
                </span>
                <span className="mt-2 hidden text-[10px] uppercase tracking-[0.18em] text-neutral-500 sm:block">
                  Convert · Bridge · Cash out
                </span>
              </span>
            </a>

            {/* ---- Center links (desktop) -------------------------------- */}
            <ul className="hidden items-center gap-1 lg:flex">
              {links.map((link) => (
                <li key={link.href}>
                  {/* LIGHT-INVERTED: text-white/65 -> text-neutral-500 */}
                  <a
                    href={link.href}
                    className="relative rounded-full px-4 py-2 text-sm text-neutral-500 transition-colors duration-200 hover:text-[#111111] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900/20"
                  >
                    <span className="absolute inset-0 rounded-full transition-colors duration-200 hover:bg-black/[0.04]" />
                    <span className="relative">{link.label}</span>
                  </a>
                </li>
              ))}
            </ul>

            {/* ---- Actions ----------------------------------------------- */}
            <div className="flex items-center gap-2">
              <a
                href="/login"
                className="hidden rounded-full px-4 py-2 text-sm text-neutral-500 transition-colors hover:text-[#111111] sm:block"
              >
                Log in
              </a>

              {/* LIGHT-INVERTED: white pill -> near-black pill, sheen now white. */}
              <a
                href={launchHref}
                className="group relative inline-flex items-center gap-2 overflow-hidden whitespace-nowrap rounded-full bg-[#111111] px-4 py-2.5 text-sm font-semibold text-white transition-transform duration-200 hover:scale-[1.03] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900/30 sm:px-5"
              >
                <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
                <span className="relative sm:hidden">Launch</span>
                <span className="relative hidden sm:inline">{launchLabel}</span>
                <ArrowRight className="relative h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
              </a>

              <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                aria-expanded={open}
                aria-label={open ? "Close navigation" : "Open navigation"}
                className="grid h-10 w-10 place-items-center rounded-full border border-black/[0.08] bg-black/[0.02] text-neutral-700 lg:hidden"
              >
                {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
              </button>
            </div>
          </nav>

          {/* ---- Mobile drawer ------------------------------------------- */}
          {open && (
            <ul className="mt-3 grid gap-1 border-t border-black/[0.07] pt-3 lg:hidden">
              {links.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    onClick={() => setOpen(false)}
                    className="block rounded-xl px-4 py-2.5 text-sm text-neutral-600 transition-colors hover:bg-black/[0.04] hover:text-[#111111]"
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
 * Hero — fully centered, 3D as background
 * ========================================================================== */

interface HeroProps {
  launchHref: string;
  networks: SupportedNetwork[];
}

const Hero: FC<HeroProps> = ({ launchHref, networks }) => (
  <section className="relative isolate grid min-h-screen place-items-center overflow-hidden px-4">
    {/* ---- Layer 1: the 3D background --------------------------------- */}
    <div className="absolute inset-0 -z-20" aria-hidden>
      <HeroScene />
    </div>

    {/*
      ---- Layer 2: legibility mask ------------------------------------
      The scene renders full-bleed, so a soft white wash is painted over its
      middle. The centre is fully opaque white where the headline sits and
      falls off to transparent at the edges, which keeps the geometry visible
      as a halo around the type instead of behind it. This is the single
      element doing the "don't make the text unreadable" work — tune the
      middle stop (currently 30%) to reveal more or less of the model.

      This is much lighter than earlier revisions because the coin ring is
      hollow: the headline already lands in the gap at the centre of the orbit,
      so the wash only has to soften the few coins that swing across the type
      rather than blanket the whole middle of the screen.

      The wash is pure white to match the page gradient's centre stop — a
      near-white like #FCFCFC would read as a visible grey disc sitting on top
      of the gradient.
    */}
    <div
      // The mask is sized in PERCENTAGES of the viewport, so the desktop
      // ellipse shrinks to ~105px across on a 390px phone and stops covering
      // the headline at all. The mobile-first value is a much wider, flatter
      // ellipse tuned to the stacked mobile text block.
      className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_92%_34%_at_50%_50%,rgba(255,255,255,0.9)_0%,rgba(255,255,255,0.8)_45%,rgba(255,255,255,0.35)_76%,rgba(255,255,255,0)_100%)] sm:bg-[radial-gradient(ellipse_46%_34%_at_50%_48%,rgba(255,255,255,0.82)_0%,rgba(255,255,255,0.66)_45%,rgba(255,255,255,0.22)_76%,rgba(255,255,255,0)_100%)]"
      aria-hidden
    />

    {/* ---- Layer 3: content -------------------------------------------- */}
    <div className="relative flex max-w-3xl flex-col items-center text-center">
      <h1 className="text-balance text-5xl font-bold leading-[1.05] tracking-[-0.035em] text-[#111111] sm:text-6xl lg:text-7xl">
        Turn any token into spendable money.
      </h1>

      <p className="mt-6 max-w-2xl text-pretty text-base leading-relaxed text-neutral-500 sm:text-lg">
        Cross-chain swaps and crypto-to-fiat payouts on one route. Rates locked before you
        sign. Invariant routes liquidity across 24 chains and 51 countries.
      </p>

      {/* ---- CTAs ---------------------------------------------------- */}
      <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
        <a
          href={launchHref}
          className="inline-flex items-center rounded-full bg-[#111111] px-7 py-3.5 text-sm font-semibold text-white transition-transform duration-200 hover:scale-[1.03] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900/30"
        >
          Convert now
        </a>

        <a
          href="#rates"
          className="group inline-flex items-center gap-2 rounded-full border border-black/[0.12] bg-white px-7 py-3.5 text-sm font-semibold text-[#111111] transition-colors hover:bg-neutral-50"
        >
          See live rates
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
        </a>
      </div>

      {/* ---- Supported networks --------------------------------------- */}
      <ul className="mt-20 flex flex-wrap items-center justify-center gap-x-8 gap-y-4">
        {networks.map(({ label, logo }) => (
          <li key={label}>
            <span className="inline-flex items-center gap-2.5 text-sm font-semibold tracking-tight text-neutral-500 transition-colors hover:text-neutral-800">
              {/*
                `unoptimized` is deliberate. Next's image optimizer refuses SVGs
                unless you set `images.dangerouslyAllowSVG` in next.config —
                bypassing it keeps these working with zero config. Swap to a
                plain <img> if you'd rather not use next/image at all.
                Decorative: the visible label already names the chain, so alt
                is empty rather than duplicating it for screen readers.
              */}
              <Image
                src={logo}
                alt=""
                width={20}
                height={20}
                unoptimized
                className="h-5 w-5 object-contain"
              />
              {label}
            </span>
          </li>
        ))}
      </ul>
    </div>
  </section>
);

/* ==========================================================================
 * Supporting sections
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
    body: "We hold the quote for 30 seconds and absorb the slippage. What the quote shows is what lands in your account.",
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
  <section id="features" className="relative mx-auto w-[min(1200px,calc(100%-2rem))] py-28">
    <div className="mx-auto max-w-2xl text-center">
      <span className="inline-flex items-center gap-2 rounded-full border border-black/[0.08] bg-white px-3.5 py-1.5 text-xs font-medium tracking-wide text-neutral-500">
        <BadgeCheck className="h-3.5 w-3.5 text-neutral-400" />
        Why it converts
      </span>
      <h2 className="mt-5 text-balance text-4xl font-bold tracking-[-0.03em] text-[#111111] sm:text-5xl">
        Built for the moment you actually need the money.
      </h2>
    </div>

    <div className="mt-14 grid gap-4 sm:grid-cols-2">
      {FEATURES.map(({ title, body, icon: Icon }) => (
        <div
          key={title}
          className="rounded-3xl border border-black/[0.07] bg-white p-7 transition-shadow duration-300 hover:shadow-[0_12px_40px_-18px_rgba(15,23,42,0.25)]"
        >
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-neutral-100 text-neutral-700">
            <Icon className="h-5 w-5" />
          </span>
          <h3 className="mt-5 text-lg font-semibold tracking-tight text-[#111111]">{title}</h3>
          <p className="mt-2 text-sm leading-relaxed text-neutral-500">{body}</p>
        </div>
      ))}
    </div>
  </section>
);

const ClosingCta: FC<{ launchHref: string; launchLabel: string }> = ({
  launchHref,
  launchLabel,
}) => (
  <section id="docs" className="mx-auto mb-28 w-[min(1200px,calc(100%-2rem))]">
    <div className="rounded-[2rem] border border-black/[0.07] bg-neutral-50 px-8 py-20 text-center sm:px-16">
      <h2 className="text-balance text-4xl font-bold tracking-[-0.03em] text-[#111111] sm:text-5xl">
        Your first conversion takes under a minute.
      </h2>
      <p className="mx-auto mt-4 max-w-lg text-neutral-500">
        Connect a wallet, pick a payout account, and watch the quote settle. No signup wall,
        no minimums.
      </p>
      <div className="mt-9 flex flex-wrap justify-center gap-3">
        <a
          href={launchHref}
          className="inline-flex items-center gap-2 rounded-full bg-[#111111] px-7 py-3.5 text-sm font-semibold text-white transition-transform hover:scale-[1.03]"
        >
          {launchLabel}
          <ArrowRight className="h-4 w-4" />
        </a>
        <a
          href="/docs"
          className="inline-flex items-center gap-2 rounded-full border border-black/[0.12] bg-white px-7 py-3.5 text-sm font-semibold text-[#111111] transition-colors hover:bg-neutral-50"
        >
          <BookOpen className="h-4 w-4 text-neutral-400" />
          Read the docs
        </a>
      </div>
    </div>
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
  networks = DEFAULT_NETWORKS,
}) => (
  /*
   * The page surface: a radial silver-to-white gradient — white at the centre
   * through gray-100 to gray-300 at the edges, reading as a soft brushed-metal
   * sheet. `bg-fixed` anchors it to the viewport rather than the (much taller)
   * document, so the falloff stays a lighting effect instead of stretching
   * over the full scroll height and flattening to grey.
   */
  <div className="relative min-h-screen bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-white via-gray-100 to-gray-300 bg-fixed font-sans antialiased selection:bg-neutral-900 selection:text-white">
    <Navbar brand={brand} links={navLinks} launchHref={launchHref} launchLabel={launchLabel} />

    <main>
      <Hero launchHref={launchHref} networks={networks} />
      <FeatureGrid />
      <ClosingCta launchHref={launchHref} launchLabel={launchLabel} />
    </main>

    <footer id="security" className="border-t border-black/[0.07] py-10">
      <div className="mx-auto flex w-[min(1200px,calc(100%-2rem))] flex-col items-center justify-between gap-4 text-sm text-neutral-400 sm:flex-row">
        <span>
          © {new Date().getFullYear()} {brand} Labs. Non-custodial. Audited.
        </span>
        <div className="flex gap-6">
          <a href="/terms" className="transition-colors hover:text-neutral-700">
            Terms
          </a>
          <a href="/privacy" className="transition-colors hover:text-neutral-700">
            Privacy
          </a>
          <a href="/status" className="transition-colors hover:text-neutral-700">
            Status
          </a>
        </div>
      </div>
    </footer>
  </div>
);

export default InvariantLanding;
