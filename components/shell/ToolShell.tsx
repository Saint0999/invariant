/**
 * ToolShell.tsx
 * ---------------------------------------------------------------------------
 * The page frame the tool routes share: charcoal base, neutral ambient washes,
 * glass header with the brand and the tool switcher, thin footer.
 *
 * Extracted when /rates arrived and made this the second copy of the same
 * shell. A third would have guaranteed drift — three places to update the
 * moment the header gains an item, and three chances to get the wash opacities
 * subtly different so the routes stop looking like the same product.
 *
 * NOT shared with the landing page. InvariantLanding is one self-contained
 * client component with smooth scrolling, a 3D hero and pinned scroll sections;
 * what carries over here is the visual language, not the machinery. The values
 * below are copied from it deliberately: #141416 base, a cool grey top light
 * and two low side lamps, translucent graphite glass at 40% over a heavy blur.
 *
 * Stays a Server Component — it renders no interactive state, so a route can
 * wrap a client tool in it without pulling the whole frame into the bundle.
 */

import Link from "next/link";
import { ArrowUpDown } from "lucide-react";
import type { FC, ReactNode } from "react";

/** The tool routes, in the order they appear in the header. */
const TOOL_LINKS: Array<{ href: string; label: string }> = [
  { href: "/converter", label: "Converter" },
  { href: "/rates", label: "Rates" },
];

export interface ToolShellProps {
  /** Route of the current page, so its header link reads as selected. */
  active: string;
  children: ReactNode;
}

const ToolShell: FC<ToolShellProps> = ({ active, children }) => (
  <div className="relative min-h-screen bg-[#141416] font-sans antialiased selection:bg-white selection:text-[#141416]">
    {/* Ambient washes: a cool grey top light and two low side lamps, all
        neutral. The warm/cool split is what keeps a monochrome page from
        looking dead; an actual hue here does not. */}
    <div className="pointer-events-none fixed inset-0 z-0" aria-hidden>
      <div className="absolute left-1/2 top-[-12rem] h-[42rem] w-[75rem] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse_at_center,rgba(228,228,231,0.09),transparent_70%)] blur-3xl" />
      <div className="absolute -left-40 top-1/3 h-[32rem] w-[32rem] rounded-full bg-[radial-gradient(circle,rgba(214,205,193,0.05),transparent_70%)] blur-3xl" />
      <div className="absolute -right-40 top-2/3 h-[32rem] w-[32rem] rounded-full bg-[radial-gradient(circle,rgba(180,188,200,0.05),transparent_70%)] blur-3xl" />
    </div>

    {/*
      pt-4 HERE rather than mt-4 on the header.

      A top margin on the first child has nothing to collapse against in this
      chain — neither this wrapper nor the shell above it has padding, a border
      or its own formatting context — so it collapsed all the way out through
      <body>, starting the body box 16px down the viewport and exposing a strip
      of the canvas above the page. Padding cannot collapse, so the gap stays
      inside the coloured box where it belongs.
    */}
    <div className="relative z-10 pt-4">
      {/*
        Static rather than fixed. The pickers on these pages open downward into
        the page, and a floating header is the one thing they would scroll
        underneath — and unlike the landing page there is no long scroll here
        that would make a persistent navbar earn its keep.
      */}
      <header className="mx-auto w-[min(1200px,calc(100%-2rem))]">
        <div className="flex items-center justify-between gap-4 rounded-2xl border-b border-white/10 bg-[#1D1D21]/40 px-4 py-3 shadow-[0_8px_32px_-12px_rgba(0,0,0,0.7)] backdrop-blur-xl backdrop-saturate-150 sm:px-5">
          <Link href="/" className="flex items-center gap-3">
            {/* Silver chip with a dark glyph — the one high-key element in an
                otherwise low-key header, same as the landing navbar. */}
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-white via-[#E4E4E7] to-[#A1A1AA] ring-1 ring-inset ring-white/40">
              <ArrowUpDown className="h-4 w-4 text-[#141416]" strokeWidth={2.75} />
            </span>
            <span className="flex flex-col leading-none">
              <span className="text-[15px] font-semibold tracking-tight text-white">Invariant</span>
              <span className="mt-2 hidden text-[10px] uppercase tracking-[0.18em] text-white/40 sm:block">
                Convert · Bridge · Cash out
              </span>
            </span>
          </Link>

          <nav className="flex items-center gap-1" aria-label="Tools">
            {TOOL_LINKS.map(({ href, label }) => {
              const current = href === active;

              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={current ? "page" : undefined}
                  className={
                    "rounded-full px-3.5 py-2 text-sm font-semibold transition-colors sm:px-4 " +
                    (current
                      ? "bg-white/[0.1] text-white"
                      : "text-white/50 hover:text-white")
                  }
                >
                  {label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      <main className="py-14 sm:py-20">{children}</main>

      <footer className="border-t border-white/[0.08] py-8">
        <p className="mx-auto w-[min(1200px,calc(100%-2rem))] text-center text-sm text-white/35">
          © {new Date().getFullYear()} Invariant Labs. Non-custodial. Audited.
        </p>
      </footer>
    </div>
  </div>
);

export default ToolShell;
