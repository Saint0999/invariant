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
import { useState, type CSSProperties, type FC, type ReactNode } from "react";
import { ArrowRight, ArrowUpDown, Menu, TrendingUp, X } from "lucide-react";

import Collapse from "@/components/ui/Collapse";
import GradualBlur from "./GradualBlur";
import SceneGlow from "./SceneGlow";
import Starfield from "./Starfield";
import GraphDemo from "./GraphDemo";
import ScrollFloat from "./ScrollFloat";
import ScrollPin from "./ScrollPin";
import SmoothScroll from "./SmoothScroll";
import ToolPreview from "./ToolPreview";

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

/*
  Two of these are ROUTES, not anchors. "Security" and "Docs" pointed at a
  footer and a closing pitch — a nav slot spent sending the reader to the bottom
  of the page they are already on. The two tools are the product, and they were
  reachable only from the hero's buttons and the preview cards further down.

  "Currencies" stays an anchor, but see CurrencyCloud for where it lands: the
  section it names is a scroll-scrubbed animation, and the top of it is a blank
  screen until the reader scrolls.
*/
const DEFAULT_NAV: NavLink[] = [
  { label: "Currencies", href: "#currencies" },
  { label: "Convert", href: "/converter" },
  { label: "Live rates", href: "/rates" },
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

/*
  The loading state is the SAME wash HeroScene renders under its canvas, so the
  moment the chunk lands nothing on screen changes — the scene then fades the
  coins up over it. See SceneGlow.tsx.
*/
const HeroScene = dynamic(() => import("./HeroScene"), {
  ssr: false,
  loading: () => <SceneGlow />,
});


/* ==========================================================================
 * Primitives
 * ========================================================================== */

interface GlassProps {
  className?: string;
  children: ReactNode;
}

/**
 * The frosted glass surface, charcoal variant: a translucent graphite fill over
 * a backdrop blur, so the coins passing behind it soften and show through
 * rather than being blocked out. Graphite rather than black — over a #141416
 * page a black fill only ever reads as a darker hole, where #1D1D21 lifts.
 *
 * The fill is light and the blur heavy on purpose. Those two work against each
 * other: raise the fill and the glass stops being glass, because there is
 * nothing left behind it to blur. `saturate` puts back the colour that a large
 * blur radius averages away, which is what keeps a gold coin behind the bar
 * reading as gold rather than as a grey smudge.
 *
 * Deliberately only these properties plus the shadow. Earlier revisions stacked
 * an inner ring and a heavy border on the same fill, and together those read as
 * a solid bar — which is the bug that keeps recurring. Keep this minimal.
 */
const GlassPanel: FC<GlassProps> = ({ className = "", children }) => (
  <div
    className={
      "relative rounded-3xl border-b border-white/10 bg-[#1D1D21]/40 shadow-[0_8px_32px_-12px_rgba(0,0,0,0.7)] backdrop-blur-xl backdrop-saturate-150 " +
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

  /*
    animate-page-in: fades in on arrival, with the hero copy following a beat
    later, so a click back to home matches the way the tool routes arrive.

    The class goes on the fixed header ITSELF, never on a wrapper around it. A
    transform on an ancestor makes that ancestor the containing block for any
    fixed descendant, so a wrapper here would tack the navbar to the top of the
    hero and scroll it away with the page.
  */
  return (
    <header className="fixed inset-x-0 top-0 z-50 animate-page-in">
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
              <span className="text-[15px] font-semibold tracking-tight text-white">{brand}</span>
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
            {/*
              ONE action, and it is the tool. There is deliberately no "Log in"
              beside it: nothing here is behind an account, so a sign-in link
              would promise a door that does not exist and imply the product
              keeps something of yours. Two sections further down disown a
              signup outright; a login control here contradicts both.
            */}
            <div className="flex items-center gap-2">
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
          {/*
            Collapse rather than a bare `open &&`: the links used to appear at
            full height on the first paint, which reads as a jump rather than an
            opening. It eases grid-template-rows to the list's own height and
            holds the element through the closing animation, so shutting the
            drawer is the same movement reversed. lg:hidden lives on the wrapper
            so the desktop layout never mounts it.

            The border and top padding are INSIDE the collapsing element. On the
            <ul> they would sit outside the animated track and paint a stray
            divider under a closed header.
          */}
          <div className="lg:hidden">
            <Collapse open={open}>
              <ul className="mt-3 grid gap-1 border-t border-white/10 pt-3">
                {links.map((link, i) => (
                  <li key={link.href}>
                    <a
                      href={link.href}
                      onClick={() => setOpen(false)}
                      /* Each link fades up a beat after the one above it, so the
                         list resolves in sequence instead of arriving as a block.
                         Staggered off the panel's own 300ms, short enough that the
                         last item still lands with it. */
                      style={{ animationDelay: `${60 + i * 55}ms` }}
                      className="block animate-rise-in rounded-xl px-4 py-2.5 text-sm text-white/70 transition-colors hover:bg-white/[0.06] hover:text-white"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </Collapse>
          </div>
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
    {/*
      Masked out towards the bottom edge. The section is `overflow-hidden` and
      the canvas ends exactly on its boundary, so without this the light rays —
      whose shader clamps its own fade at 0.5, i.e. never reaches zero — get
      chopped mid-brightness and the seam reads as two different pages butted
      together.

      A MASK rather than a charcoal scrim on top: the canvas is alpha:true, so
      masking simply reveals the page gradient behind it and there is no colour
      to keep in sync. A scrim would have to hard-code whatever #141416→#101012
      happens to be at this scroll offset, and drift the moment either changes.

      It fades the orbiting coins along with the rays, which is the intent — they
      dissolve into the page instead of being sliced off at the edge. Hence the
      late 70% start and the extra midpoint stop: the brightness difference being
      neutralised is subtle, so the ramp only needs the last stretch, and holding
      full opacity until then keeps the gold on the lower coins.
    */}
    <div
      className="absolute inset-0 -z-20 [-webkit-mask-image:linear-gradient(to_bottom,#000_0%,#000_70%,rgba(0,0,0,0.55)_86%,transparent_100%)] [mask-image:linear-gradient(to_bottom,#000_0%,#000_70%,rgba(0,0,0,0.55)_86%,transparent_100%)]"
      aria-hidden
    >
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
    {/* Copy only. The orbit behind it is left alone: the WebGL bundle lands
        whenever it lands, so a fade tied to this mount would run before the
        canvas exists and finish before it arrives. SceneFallback covers that
        gap instead. */}
    <div className="animate-page-in-delayed relative flex max-w-3xl flex-col items-center text-center">
        {/* Brushed-silver headline: a top-to-bottom white → #9A9AA4 clip, which
            is where the reference gets its metallic type. `pb-1` because a
            clipped gradient crops descenders flush at the box edge. */}
        <h1 className="text-balance bg-gradient-to-b from-white via-[#E8E8EC] to-[#9A9AA4] bg-clip-text pb-1 text-5xl font-bold leading-[1.05] tracking-[-0.035em] text-transparent sm:text-6xl">
          Every token, priced in your currency.
        </h1>

        {/* Claims only what the two routes do: read prices and convert between
            them. The earlier version sold swaps, payouts and locked rates,
            none of which this product performs. */}
        <p className="mt-6 max-w-2xl text-pretty text-base leading-relaxed text-white/55 sm:text-lg">
          Live mid-market rates for 16 tokens and 20 world currencies, refreshed every 30
          seconds. Convert in either direction, or read the whole board at once.
        </p>

        {/* ---- CTAs ---------------------------------------------------- */}
        <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
          <a
            href={launchHref}
            className="inline-flex items-center rounded-full bg-white px-7 py-3.5 text-sm font-semibold text-[#141416] transition-transform duration-200 hover:scale-[1.03] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
          >
            Convert now
          </a>

          {/* Points at /rates now that the board exists — this button has said
              "See live rates" since the first draft, and until now the nearest
              thing to that was the converter's single quote line. */}
          <a
            href="/rates"
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

/**
 * One tile in the currency cloud.
 *
 * `x`/`y` are the tile's CENTRE as a percentage of the section box — the
 * wrapper pulls itself back by half its own size — so a tile can be placed
 * relative to the headline without knowing how big it renders at.
 */
interface CloudCoin {
  label: string;
  /** Path to the coin mark under /public, e.g. "/btc.svg". */
  logo: string;
  x: string;
  y: string;
  size: "sm" | "md" | "lg";
  /** Resting rotation in degrees; the float animation swings through it. */
  tilt: number;
  /** Pixels of travel at the midpoint of the float, x then y. */
  drift: [number, number];
  /** Seconds. Staggered so no two neighbours drift in phase. */
  delay: number;
  duration: number;
  /**
   * Tiles this far out get dropped on phones — at 390px wide the outer ring
   * would otherwise sit on top of the headline rather than around it.
   */
  desktopOnly?: boolean;
}

/*
  Thirteen marks, hand-placed rather than generated: nine assets plus the four
  networks (Solana, Base, Arbitrum, Polygon) that also appear in the hero row.

  SCATTERED, NOT RINGED. The earlier pass placed these at roughly one radius
  from the centre and walked round the edge in order, and the eye reads that as
  a circle however uneven the individual offsets are. What breaks it is varying
  the DISTANCE, not the angle: Tether and Cardano sit just outside the type,
  Bitcoin and Dogecoin a good deal further out, USD Coin and Arbitrum right out
  at the margins. Some sit almost on top of each other, some have a lot of empty
  space around them — even spacing is the other half of what reads as a ring.

  The only hard rule is the centre, roughly 24–76% across and 32–70% down,
  which stays clear for the headline. Everything else is judged by eye.
*/
const CLOUD_COINS: CloudCoin[] = [
  { label: "Solana", logo: "/sol.svg", x: "44%", y: "7%", size: "sm", tilt: -5, drift: [11, -26], delay: 2.6, duration: 11.5 },
  /*
    LOCKED TO BITCOIN: identical drift, delay and duration, which is why these
    two are the only tiles in the cloud sharing a phase.

    Matching dx alone was enough at the old amplitude. It is not any more. Each
    tile travels from rest to peak and back, so the worst case between two of
    them is one at full extension while the other sits at zero — about 26px
    here, against a resting gap of ~19px once both are drawn at their phone
    sizes. Independent timings guarantee that moment arrives eventually; it just
    takes until their periods drift out of step, which is why a short look at
    the page never catches it.

    Identical timing makes the relative displacement exactly zero instead of
    merely small, so the pair holds its gap forever at full amplitude. Two tiles
    in step out of thirteen is not the synchronised-sheet problem the keyframes
    warn about — that needs neighbours moving together across the whole cloud.
  */
  { label: "Ethereum", logo: "/eth.svg", x: "33%", y: "22%", size: "md", tilt: 6, drift: [13, -23], delay: 0, duration: 15.5 },
  { label: "Tether", logo: "/usdt.svg", x: "66%", y: "24%", size: "sm", tilt: 9, drift: [8, -28], delay: 0.8, duration: 10.5 },
  // Same trap as Ethereum/Bitcoin, and it only bites on a phone: this pair is
  // ~25px apart there once BNB is drawn at its large size, so the opposing dx
  // this used to carry closed the gap completely at the wider amplitude. Both
  // now drift right, which leaves ~4px of relative travel between them.
  { label: "BNB", logo: "/bnb.svg", x: "87%", y: "19%", size: "lg", tilt: -6, drift: [12, -20], delay: 2, duration: 15 },
  { label: "XRP", logo: "/xrp.svg", x: "79%", y: "41%", size: "sm", tilt: 7, drift: [14, -23], delay: 3.2, duration: 12.5, desktopOnly: true },
  { label: "Base", logo: "/base.svg", x: "93%", y: "63%", size: "sm", tilt: 5, drift: [-11, -27], delay: 1.1, duration: 11, desktopOnly: true },
  // desktopOnly for the same reason as USD Coin below: with the box shortened
  // on mobile this one lands on the last two lines of the support paragraph.
  { label: "Avalanche", logo: "/avax.svg", x: "68%", y: "73%", size: "md", tilt: 7, drift: [13, -22], delay: 1.2, duration: 13, desktopOnly: true },
  { label: "Arbitrum", logo: "/arb.svg", x: "83%", y: "90%", size: "md", tilt: -7, drift: [-14, -24], delay: 2.9, duration: 14.5 },
  { label: "Polygon", logo: "/matic.svg", x: "52%", y: "93%", size: "sm", tilt: -4, drift: [15, -19], delay: 2.3, duration: 11 },
  { label: "Cardano", logo: "/ada.svg", x: "34%", y: "77%", size: "sm", tilt: 6, drift: [-10, -28], delay: 3.6, duration: 9.5 },
  /*
    The one tile that drifts DOWN, and it earns its place twice over.

    Cardano sits just above it and the two already overlap horizontally at rest,
    so the ~21px between them vertically is the entire separation — and this
    tile rising 21px closed exactly that. Falling instead opens the gap at both
    extremes rather than shutting it at one.

    It also breaks the one axis every other tile shares. The keyframes note that
    per-tile dx is what stops the cloud reading as a single sheet; a tile moving
    against the grain does more for that than any amount of horizontal jitter.
  */
  { label: "Dogecoin", logo: "/doge.svg", x: "21%", y: "88%", size: "lg", tilt: -9, drift: [11, 18], delay: 1.9, duration: 14 },
  // desktopOnly: on a 390px screen the support paragraph runs the full width
  // and this tile lands underneath the second line of it.
  { label: "USD Coin", logo: "/usdc.svg", x: "6%", y: "61%", size: "md", tilt: 8, drift: [-12, -25], delay: 0.4, duration: 12, desktopOnly: true },
  { label: "Bitcoin", logo: "/btc.svg", x: "12%", y: "25%", size: "lg", tilt: -8, drift: [13, -23], delay: 0, duration: 15.5 },
];

/** Tile box + inner mark, kept in step so the mark never crowds its padding. */
const COIN_SIZES: Record<CloudCoin["size"], { box: string; mark: string }> = {
  sm: { box: "h-11 w-11 rounded-xl sm:h-14 sm:w-14 sm:rounded-2xl", mark: "h-5 w-5 sm:h-7 sm:w-7" },
  md: { box: "h-14 w-14 rounded-2xl sm:h-[4.5rem] sm:w-[4.5rem]", mark: "h-7 w-7 sm:h-9 sm:w-9" },
  lg: { box: "h-16 w-16 rounded-2xl sm:h-[5.5rem] sm:w-[5.5rem] sm:rounded-3xl", mark: "h-8 w-8 sm:h-11 sm:w-11" },
};

/**
 * The currency cloud — headline in the middle, supported assets drifting around
 * it. Replaces the old four-card feature grid: the cards said in prose what the
 * marks now say at a glance, and a wall of copy right under a 3D hero was the
 * part of the page people scrolled past.
 *
 * The tiles are decorative and the section is `aria-hidden` on the cloud only —
 * the headline and the supporting line carry the meaning, and thirteen list
 * items of chain names read as noise in a screen reader.
 */
const CurrencyCloud: FC = () => (
  /*
    The pin's wrapper carries height and nothing else, so the section element —
    the landmark and the #currencies anchor the navbar points at — sits outside
    it. No `overflow` on this element: it is an ancestor of a sticky child.
  */
  <section className="relative mx-auto my-8 w-[min(1200px,calc(100%-2rem))] sm:my-28">
    {/*
      THE ANCHOR IS NOT THE TOP OF THE SECTION.

      Jumping to the section element landed the reader at the start of the pin,
      where the scene is legitimately empty — the two headline lines have not
      begun resolving yet — so the nav appeared to link to a blank screen that
      only filled in if you happened to keep scrolling.

      This marker sits at the scroll offset where the sequence has finished, so
      the jump arrives on the resolved pair. The number is derived, not guessed:
      ScrollPin's progress is -wrapperTop / (wrapperHeight - 100vh), so landing
      at progress p means putting the viewport top p × travel into the wrapper.
      The second line completes at 0.88 and the pin holds to 1.0, so 0.92 is
      just past the finish with a little of the hold to spare:

        desktop  0.92 × (380vh - 100vh) = 257.6vh
        mobile   0.92 × (320vh - 100vh) = 202.4vh

      Keep these in step with the wrapper heights below and with ScrollFloat's
      `to` value. motion-reduce pins it back to the top, where that variant
      collapses the wrapper to one screen and there is no travel to offset into.
    */}
    <span
      id="currencies"
      className="pointer-events-none absolute left-0 top-[202.4vh] motion-reduce:top-0 sm:top-[257.6vh]"
      aria-hidden
    />
    <ScrollPin
      /*
      The wrapper's only job is height, and its height is the animation's
      pacing: 100vh of it is the scene itself and everything past that is the
      hold. 380vh gives nearly three full viewports of scrolling for the two
      headline lines to resolve in, which is what makes the sequence read as
      slow rather than as things snapping in.

      Mobile gets 320vh — the same sequence over a shorter distance, because
      a phone's viewport is tall relative to its scroll speed and matching the
      desktop figure there feels like the page has stopped responding.

      motion-reduce collapses the whole thing to a single screen: with the
      animation off there is nothing to scrub, and holding a reader in place
      for two viewports of nothing is exactly the experience the media query
      exists to prevent.
    */
      className="h-[320vh] motion-reduce:h-screen sm:h-[380vh]"
    /*
      overflow-hidden lives HERE, on the sticky scene, not on the wrapper —
      an `overflow` other than visible on any ancestor of a sticky element
      switches it off without warning. isolate keeps the -z-10 layers below
      from escaping behind the page background.
    */
      sceneClassName="relative isolate grid h-screen place-items-center overflow-hidden"
    >
    {/*
      ---- Layer 1: the drifting marks ---------------------------------
      Inset from the scene's edges rather than pinned to them. The tiles are
      positioned as percentages of this layer, and at full bleed the topmost
      marks sat under the fixed navbar and the lowest ran off the bottom of a
      short viewport.
    */}
    <div
      className="pointer-events-none absolute inset-x-0 bottom-[6%] top-[11%] -z-10 sm:bottom-[5%] sm:top-[9%]"
      aria-hidden
    >
      {CLOUD_COINS.map(({ label, logo, x, y, size, tilt, drift, delay, duration, desktopOnly }) => {
        const { box, mark } = COIN_SIZES[size];

        return (
          <div
            key={label}
            className={
              "absolute -translate-x-1/2 -translate-y-1/2 " +
              (desktopOnly ? "hidden sm:block" : "block")
            }
            style={{ left: x, top: y }}
          >
            {/*
              Two nested elements on purpose: the wrapper owns the centring
              translate, the child owns the animation. Collapsing them would put
              the keyframes and the -50%/-50% on the same `transform`, and the
              animation would win — every tile would snap to its raw left/top.
            */}
            <div
              className="animate-coin-float"
              style={
                {
                  "--coin-tilt": `${tilt}deg`,
                  "--coin-dx": `${drift[0]}px`,
                  "--coin-dy": `${drift[1]}px`,
                  "--coin-delay": `${delay}s`,
                  "--coin-dur": `${duration}s`,
                } as CSSProperties
              }
            >
              <span
                className={
                  "grid place-items-center border border-white/10 bg-white/[0.055] shadow-[0_20px_45px_-20px_rgba(0,0,0,0.95)] backdrop-blur-md " +
                  box
                }
              >
                {/* `unoptimized` for the same reason as the hero row: Next's
                    optimizer refuses SVGs without dangerouslyAllowSVG. */}
                <Image
                  src={logo}
                  alt=""
                  width={44}
                  height={44}
                  unoptimized
                  className={"object-contain " + mark}
                />
              </span>
            </div>
          </div>
        );
      })}
    </div>

    {/*
      ---- Layer 2: legibility scrim ------------------------------------
      Same charcoal wash as the hero, and for the same reason: tiles pass close
      to the headline and the type has to stay the brightest thing in the box.
      Sized in percentages, so it needs its own value per breakpoint.

      THE HORIZONTAL RADIUS MUST NOT EXCEED 50%. In a radial-gradient the first
      length is the radius, not the diameter, so `ellipse 80%` puts the gradient
      edge at 1.6× the box's half-width — the ramp is still around 35% opaque
      where the section ends, and `overflow-hidden` slices it there. That left
      two hard vertical seams down the sides of the mobile layout, reading as a
      panel behind the text rather than as atmosphere. At 50% the ellipse
      reaches zero exactly at the left and right edges, so there is nothing left
      to clip; the stops below are re-weighted to keep the middle as dark as it
      was. The desktop value was always under the limit, which is why the seam
      only ever showed on phones.
    */}
    <div
      className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_50%_30%_at_50%_50%,rgba(20,20,22,0.9)_0%,rgba(20,20,22,0.78)_55%,rgba(20,20,22,0.3)_82%,rgba(20,20,22,0)_100%)] sm:bg-[radial-gradient(ellipse_46%_28%_at_50%_50%,rgba(20,20,22,0.86)_0%,rgba(20,20,22,0.62)_48%,rgba(20,20,22,0.18)_80%,rgba(20,20,22,0)_100%)]"
      aria-hidden
    />

    {/* ---- Layer 3: the claim ------------------------------------------ */}
    {/* max-w-3xl, sized to the headline: at sm:text-6xl "24 chains, 51
        countries" measures ~700px, and anything narrower breaks it onto a
        third line, which loses the two-line shape the section is built on. */}
    {/*
      The two headline lines resolve in reading order while the scene is pinned,
      each taking a slice of the pin's 0–1 progress, so the sequencing is four
      numbers rather than pieces of geometry.

      The gap between the slices is deliberate — a beat where the first line
      sits finished before the second starts, which is what separates "two
      things arriving in order" from "one long continuous crawl". The 0.06
      lead-in and the 0.12 tail keep the first line from being mid-animation the
      instant the pin engages, and let the finished pair hold on screen before
      the scene releases.
    */}
    <div className="relative flex max-w-3xl flex-col items-center text-center">
      {/* Plain text, deliberately: the eyebrow is the label the two headline
          lines complete, so it wants to be already there when they arrive
          rather than being a third thing that animates. */}
      <p className="text-sm font-semibold tracking-tight text-white/55 sm:text-base">
        One route across
      </p>

      {/*
        The brushed-silver clip sits on each CHARACTER now rather than on the
        h2. `background-clip: text` is not carried into a transformed
        descendant, so with the gradient on the h2 the moving characters paint
        as nothing and the headline disappears for the whole animation. Per
        character the ramp runs over one line box instead of two, which is
        within a shade of the old two-line ramp.

        `pb-1` for the same reason as before: a clipped gradient crops
        descenders flush at the box edge.
      */}
      <h2 className="mt-3 text-balance pb-1 text-[2.6rem] font-bold leading-[1.05] tracking-[-0.035em] sm:text-6xl">
        <ScrollFloat
          charClassName="bg-gradient-to-b from-white via-[#E8E8EC] to-[#9A9AA4] bg-clip-text text-transparent"
          from={0.06}
          to={0.44}
          blur={14}
        >
          180+ assets
        </ScrollFloat>
        <ScrollFloat
          charClassName="bg-gradient-to-b from-white via-[#E8E8EC] to-[#9A9AA4] bg-clip-text text-transparent"
          from={0.52}
          to={0.88}
          blur={14}
        >
          24 chains, 51 countries
        </ScrollFloat>
      </h2>
      </div>
    </ScrollPin>
  </section>
);

const ClosingCta: FC<{ launchHref: string; launchLabel: string }> = ({
  launchHref,
  launchLabel,
}) => (
  <section id="get-started" className="mx-auto mb-28 w-[min(1200px,calc(100%-2rem))]">
    <div className="relative overflow-hidden rounded-[2rem] border border-white/[0.08] bg-gradient-to-b from-white/[0.06] to-white/[0.015] px-8 py-20 text-center backdrop-blur-sm sm:px-16">
      {/*
        Stars behind the copy. First, so it is the bottom layer of the card;
        every element after it carries `relative`, which is what lifts the text
        above it without needing a z-index on anything. The card's own
        overflow-hidden keeps the field inside the rounded corners.
      */}
      <Starfield />

      <div
        className="pointer-events-none absolute left-1/2 top-0 h-72 w-[40rem] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse_at_center,rgba(232,232,236,0.16),transparent_70%)] blur-3xl"
        aria-hidden
      />
      {/*
        Copy describes what the two buttons below actually do. The previous
        version promised a wallet connect and a payout account, neither of
        which exists: both routes are read-only price tools that ask for
        nothing, so the pitch is that there is no setup at all.
      */}
      <h2 className="relative text-balance bg-gradient-to-b from-white to-[#9A9AA4] bg-clip-text pb-1 text-4xl font-bold tracking-[-0.03em] text-transparent sm:text-5xl">
        Start with a number, not a signup.
      </h2>
      <p className="relative mx-auto mt-4 max-w-lg text-white/55">
        Pick two assets, type an amount, read the rate. 16 tokens and 20 world currencies,
        repriced every 30 seconds. Nothing to install, nothing to connect.
      </p>
      <div className="relative mt-9 flex flex-wrap justify-center gap-3">
        <a
          href={launchHref}
          className="inline-flex items-center gap-2 rounded-full bg-white px-7 py-3.5 text-sm font-semibold text-[#141416] transition-transform hover:scale-[1.03]"
        >
          {launchLabel}
          <ArrowRight className="h-4 w-4" />
        </a>
        {/* The secondary CTA points at the other tool, not at docs. There is
            no /docs route to write about — the two things a reader can
            actually do here are convert and check rates, so the pair of
            buttons is the pair of tools, matching the header nav. */}
        <a
          href="/rates"
          className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-7 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-white/[0.1]"
        >
          <TrendingUp className="h-4 w-4 text-white/60" />
          See live rates
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
  launchHref = "/converter",
  launchLabel = "Launch Converter",
  networks = DEFAULT_NETWORKS,
}) => (
  /*
    FLAT base colour, deliberately — no page-level vertical gradient.

    There used to be a linear-gradient(#17171A → #141416 → #101012) here. Across
    the whole 2371px document that is a total travel of FOUR 8-bit values per
    channel, so the browser held each value flat for 207px in the upper third
    and 385px below before stepping. That is what produced the horizontal
    banding — the "waves" that made the page look like a low-bitrate video.

    Every other soft gradient on this page changes level every 10-24px (the
    ambient washes below, the hero scrim) and is invisible as banding. Only this
    one was pathological, because it was the only one asking for a near-zero
    slope over a very long distance.

    Deleting it costs almost nothing: the entire gradient spanned seven levels
    top to bottom, imperceptible AS a gradient but glaring as steps. The ambient
    washes below still supply the depth it was there for. Do not reintroduce a
    slow full-page gradient in near-black; there is no 8-bit colour available to
    draw it smoothly.
  */
  <div className="relative min-h-screen bg-[#141416] font-sans antialiased selection:bg-white selection:text-[#141416]">
    {/* Renders nothing; scoped here rather than in the root layout so smoothing
        stays a property of this page and not of every future route. */}
    <SmoothScroll />
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
        <CurrencyCloud />
        <ToolPreview />
        <GraphDemo />
        <ClosingCta launchHref={launchHref} launchLabel={launchLabel} />
      </main>

      {/*
        pb-24 (96px), not the pt-10 (40px) it is paired with. The bottom blur is
        a 4rem/64px band fixed to the viewport bottom, so at the end of the page
        anything within 64px of the bottom sits under it. The extra bottom
        padding is what lifts the copyright line and the legal links clear of
        that band — with ~32px of headroom — so they stay sharp while the blur
        itself keeps running. Shrinking this below 64px puts them back under it.
      */}
      <footer id="security" className="border-t border-white/[0.08] pb-24 pt-10">
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

    {/*
      Progressive blur pinned to the bottom of the VIEWPORT, so content softens
      as it scrolls off the bottom edge rather than just ending. Sits OUTSIDE the
      z-10 content wrapper and carries its own z-index; nothing between it and
      <body> uses transform/filter, which would otherwise re-anchor a fixed
      element to that ancestor instead of the viewport.

      It runs at constant strength for the whole page, including at the very
      bottom. Keeping the footer readable is the footer's pb-24 doing the work
      rather than the blur getting out of the way — see the comment there.

      curve="ease-in" holds the blur near zero for most of the band and stacks it
      into the last few pixels, so it reads as a soft edge rather than a frosted
      strip across the bottom of the page.
    */}
    <GradualBlur
      target="page"
      position="bottom"
      height="4rem"
      strength={2}
      divCount={6}
      curve="ease-in"
    />
  </div>
);

export default InvariantLanding;
