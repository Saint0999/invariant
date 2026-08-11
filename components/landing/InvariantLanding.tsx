"use client";

/**
 * InvariantLanding.tsx
 * ---------------------------------------------------------------------------
 * Landing page for a crypto-to-crypto / crypto-to-fiat converter platform.
 *
 * CHARCOAL THEME — a graphite #141416 surface lifted by a few very low-opacity
 * NEUTRAL washes (cool grey / warm silver) so it never reads as flat black.
 * Deliberately hue-free: the reference is monochrome, and any saturated glow
 * immediately breaks that read, which is why the earlier violet/cyan pass was
 * dropped. Type is white through white/60. The 3D centrepiece is a full-bleed
 * background layer behind centred content, with a charcoal scrim keeping the
 * headline legible over it.
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
 * 4. Give <body> the same base colour so there is no white flash before
 *    hydration and overscroll matches:
 *    <body className="bg-[#141416]">
 *
 * CHAIN LOGOS
 * ---------------------------------------------------------------------------
 * The supported-networks row reads SVGs from /public (/eth.svg, /sol.svg,
 * /base.svg, /arb.svg, /matic.svg). Placeholder files ship with this commit —
 * overwrite them with the real brand marks. See DEFAULT_NETWORKS.
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
    <div className="h-[38rem] w-[38rem] animate-pulse rounded-full bg-[radial-gradient(circle_at_50%_50%,rgba(226,232,240,0.13),rgba(148,163,184,0.06)_45%,transparent_72%)] blur-3xl" />
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
 * The frosted glass surface, charcoal variant: a translucent graphite fill over
 * `backdrop-blur-md`, so the 3D centrepiece behind it blurs through rather
 * than being blocked out. Graphite rather than black — over a #141416 page a
 * black fill only ever reads as a darker hole, where #1D1D21 lifts.
 *
 * Deliberately only these three properties plus the shadow. Earlier revisions
 * stacked an inner ring and a heavy border on the same fill, and together
 * those read as a solid bar — which is the bug that keeps recurring. Keep this
 * minimal.
 */
const GlassPanel: FC<GlassProps> = ({ className = "", children }) => (
  <div
    className={
      "relative rounded-3xl border-b border-white/10 bg-[#1D1D21]/55 shadow-[0_8px_32px_-12px_rgba(0,0,0,0.7)] backdrop-blur-md " +
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
              {/* Silver chip with a dark glyph — the one high-key element in an
                  otherwise low-key charcoal header, same as the reference. */}
              <span className="relative grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-white via-[#E4E4E7] to-[#A1A1AA] ring-1 ring-inset ring-white/40">
                <ArrowUpDown className="h-4 w-4 text-[#141416]" strokeWidth={2.75} />
              </span>
              <span className="flex flex-col leading-none">
                <span className="text-[15px] font-semibold tracking-tight text-white">{brand}</span>
                <span className="mt-2 hidden text-[10px] uppercase tracking-[0.18em] text-white/40 sm:block">
                  Convert · Bridge · Cash out
                </span>
              </span>
            </a>

            {/* ---- Center links (desktop) -------------------------------- */}
            {/*
              Plain text, no chrome at all — no resting border and no hover
              fill. Both made these read as four buttons competing with the one
              real CTA. Hover brightens the type only.
            */}
            <ul className="hidden items-center gap-1 lg:flex">
              {links.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    className="block rounded-full px-4 py-2 text-sm text-white/55 transition-colors duration-200 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
                  >
                    {link.label}
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
                className="group relative inline-flex items-center gap-2 overflow-hidden whitespace-nowrap rounded-full bg-white px-4 py-2.5 text-sm font-semibold text-[#141416] transition-transform duration-200 hover:scale-[1.03] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 sm:px-5"
              >
                <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-black/10 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
                <span className="relative sm:hidden">Launch</span>
                <span className="relative hidden sm:inline">{launchLabel}</span>
                <ArrowRight className="relative h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
              </a>

              <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                aria-expanded={open}
                aria-label={open ? "Close navigation" : "Open navigation"}
                className="grid h-10 w-10 place-items-center rounded-full border border-white/15 bg-white/[0.06] text-white/80 lg:hidden"
              >
                {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
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
 * Hero — centred copy, orbit running behind it
 * ========================================================================== */

interface HeroProps {
  launchHref: string;
  networks: SupportedNetwork[];
}

const Hero: FC<HeroProps> = ({ launchHref, networks }) => (
  <section className="relative isolate grid min-h-screen place-items-center overflow-hidden px-4">
    {/*
      ---- Layer 1: the orbit -------------------------------------------
      Full-bleed at every size, and centred on the same point as the copy. The
      orbit is deliberately hollow, so the headline lands in the gap and the
      coins pass around it rather than behind it.
    */}
    <div className="absolute inset-0 -z-20" aria-hidden>
      <HeroScene />
    </div>

    {/*
      ---- Layer 2: legibility scrim ------------------------------------
      A charcoal wash — it has to match the page base exactly, or it reads as a
      disc of a different grey floating over the background.

      Only has to cover the copy itself now that the orbit is hollow, so it is
      kept tight and fairly transparent: the coins should still be visible
      passing behind the text, just dimmed. Sized in viewport PERCENTAGES, so
      the desktop ellipse would collapse to ~110px across on a 390px phone —
      hence the separate mobile-first value.
    */}
    <div
      className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_95%_36%_at_50%_50%,rgba(20,20,22,0.82)_0%,rgba(20,20,22,0.64)_45%,rgba(20,20,22,0.22)_76%,rgba(20,20,22,0)_100%)] sm:bg-[radial-gradient(ellipse_42%_32%_at_50%_50%,rgba(20,20,22,0.76)_0%,rgba(20,20,22,0.56)_45%,rgba(20,20,22,0.16)_78%,rgba(20,20,22,0)_100%)]"
      aria-hidden
    />

    {/* ---- Layer 3: content -------------------------------------------- */}
    <div className="relative flex max-w-3xl flex-col items-center text-center">
        {/* Brushed-silver headline: a top-to-bottom white → #9A9AA4 clip, which
            is where the reference gets its metallic type. `pb-1` because a
            clipped gradient crops descenders flush at the box edge. */}
        <h1 className="text-balance bg-gradient-to-b from-white via-[#E8E8EC] to-[#9A9AA4] bg-clip-text pb-1 text-5xl font-bold leading-[1.05] tracking-[-0.035em] text-transparent sm:text-6xl">
          Turn any token into spendable money.
        </h1>

        <p className="mt-6 max-w-2xl text-pretty text-base leading-relaxed text-white/55 sm:text-lg">
          Cross-chain swaps and crypto-to-fiat payouts on one route. Rates locked before you
          sign. Invariant routes liquidity across 24 chains and 51 countries.
        </p>

        {/* ---- CTAs ---------------------------------------------------- */}
        <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
          <a
            href={launchHref}
            className="inline-flex items-center rounded-full bg-white px-7 py-3.5 text-sm font-semibold text-[#141416] transition-transform duration-200 hover:scale-[1.03] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
          >
            Convert now
          </a>

          <a
            href="#rates"
            className="group inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-7 py-3.5 text-sm font-semibold text-white backdrop-blur-sm transition-colors hover:border-white/30 hover:bg-white/[0.1]"
          >
            See live rates
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </a>
        </div>

        {/* ---- Supported networks --------------------------------------- */}
        <ul className="mt-16 flex flex-wrap items-center justify-center gap-x-8 gap-y-4">
          {networks.map(({ label, logo }) => (
            <li key={label}>
              <span className="inline-flex items-center gap-2.5 text-sm font-semibold tracking-tight text-white/50 transition-colors hover:text-white/80">
                {/*
                  `unoptimized` is deliberate. Next's image optimizer refuses SVGs
                  unless you set `images.dangerouslyAllowSVG` in next.config —
                  bypassing it keeps these working with zero config. Swap to a
                  plain <img> if you'd rather not use next/image at all.
                  Decorative: the visible label already names the chain, so alt
                  is empty rather than duplicating it for screen readers.
                */}
                {/* Full opacity: these carry brand colour now, and the 80% the
                    monochrome placeholders wore just muted it. */}
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
      <span className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.05] px-3.5 py-1.5 text-xs font-medium tracking-wide text-white/60 backdrop-blur-sm">
        <BadgeCheck className="h-3.5 w-3.5 text-white/50" />
        Why it converts
      </span>
      <h2 className="mt-5 text-balance bg-gradient-to-b from-white to-[#9A9AA4] bg-clip-text pb-1 text-4xl font-bold tracking-[-0.03em] text-transparent sm:text-5xl">
        Built for the moment you actually need the money.
      </h2>
    </div>

    <div className="mt-14 grid gap-4 sm:grid-cols-2">
      {FEATURES.map(({ title, body, icon: Icon }) => (
        <div
          key={title}
          className="rounded-3xl border border-white/[0.08] bg-gradient-to-b from-white/[0.055] to-white/[0.015] p-7 backdrop-blur-sm transition-colors duration-300 hover:border-white/20 hover:from-white/[0.09] hover:to-white/[0.03]"
        >
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-white/[0.14] to-white/[0.04] text-white/80 ring-1 ring-inset ring-white/10">
            <Icon className="h-5 w-5" />
          </span>
          <h3 className="mt-5 text-lg font-semibold tracking-tight text-white">{title}</h3>
          <p className="mt-2 text-sm leading-relaxed text-white/50">{body}</p>
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
    <div className="relative overflow-hidden rounded-[2rem] border border-white/[0.08] bg-gradient-to-b from-white/[0.06] to-white/[0.015] px-8 py-20 text-center backdrop-blur-sm sm:px-16">
      <div
        className="pointer-events-none absolute left-1/2 top-0 h-72 w-[40rem] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse_at_center,rgba(232,232,236,0.16),transparent_70%)] blur-3xl"
        aria-hidden
      />
      <h2 className="relative text-balance bg-gradient-to-b from-white to-[#9A9AA4] bg-clip-text pb-1 text-4xl font-bold tracking-[-0.03em] text-transparent sm:text-5xl">
        Your first conversion takes under a minute.
      </h2>
      <p className="relative mx-auto mt-4 max-w-lg text-white/55">
        Connect a wallet, pick a payout account, and watch the quote settle. No signup wall,
        no minimums.
      </p>
      <div className="relative mt-9 flex flex-wrap justify-center gap-3">
        <a
          href={launchHref}
          className="inline-flex items-center gap-2 rounded-full bg-white px-7 py-3.5 text-sm font-semibold text-[#141416] transition-transform hover:scale-[1.03]"
        >
          {launchLabel}
          <ArrowRight className="h-4 w-4" />
        </a>
        <a
          href="/docs"
          className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-7 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-white/[0.1]"
        >
          <BookOpen className="h-4 w-4 text-white/60" />
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
  <div className="relative min-h-screen bg-[#141416] bg-[linear-gradient(180deg,#17171A_0%,#141416_35%,#101012_100%)] font-sans antialiased selection:bg-white selection:text-[#141416]">
    {/*
      Muted ambient washes so the page never reads as flat charcoal. All
      NEUTRAL — a cool grey top light, a warm silver from the left, a colder
      one from the right. The warm/cool split is what keeps a monochrome page
      from looking dead; introducing an actual hue here does not.

      Very low opacity and heavily blurred: at higher values these stop being
      atmosphere and start looking like blobs. `fixed` keeps them anchored to
      the viewport across the whole scroll.
    */}
    <div className="pointer-events-none fixed inset-0 z-0" aria-hidden>
      <div className="absolute left-1/2 top-[-12rem] h-[42rem] w-[75rem] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse_at_center,rgba(228,228,231,0.09),transparent_70%)] blur-3xl" />
      <div className="absolute -left-40 top-1/3 h-[32rem] w-[32rem] rounded-full bg-[radial-gradient(circle,rgba(214,205,193,0.05),transparent_70%)] blur-3xl" />
      <div className="absolute -right-40 top-2/3 h-[32rem] w-[32rem] rounded-full bg-[radial-gradient(circle,rgba(180,188,200,0.05),transparent_70%)] blur-3xl" />
    </div>

    <div className="relative z-10">
      <Navbar brand={brand} links={navLinks} launchHref={launchHref} launchLabel={launchLabel} />

      <main>
        <Hero launchHref={launchHref} networks={networks} />
        <FeatureGrid />
        <ClosingCta launchHref={launchHref} launchLabel={launchLabel} />
      </main>

      <footer id="security" className="border-t border-white/[0.08] py-10">
        <div className="mx-auto flex w-[min(1200px,calc(100%-2rem))] flex-col items-center justify-between gap-4 text-sm text-white/40 sm:flex-row">
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
    </div>
  </div>
);

export default InvariantLanding;
