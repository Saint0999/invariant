/**
 * /converter
 * ---------------------------------------------------------------------------
 * The converter tool's route. Stays a Server Component: only the tool itself is
 * interactive, so the shell, the ambient washes and the header all render on
 * the server and just the card hydrates.
 *
 * The page shell repeats the landing page's charcoal recipe rather than
 * importing it — InvariantLanding is one self-contained client component with
 * its own scroll behaviour, 3D hero and pinned sections, none of which belong
 * on a form. What carries over is the language: #141416 base, neutral ambient
 * washes, glass header, brushed-silver type.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowUpDown } from "lucide-react";

import Converter from "@/components/converter/Converter";

export const metadata: Metadata = {
  title: "Converter — Invariant",
  description:
    "Convert any cryptocurrency into another, or straight into dollars, euros, pounds and more, at live market rates.",
};

export default function ConverterPage() {
  return (
    <div className="relative min-h-screen bg-[#141416] font-sans antialiased selection:bg-white selection:text-[#141416]">
      {/* Same neutral ambient washes as the landing page — a cool grey top
          light and two low side lamps, so the charcoal never reads as flat. */}
      <div className="pointer-events-none fixed inset-0 z-0" aria-hidden>
        <div className="absolute left-1/2 top-[-12rem] h-[42rem] w-[75rem] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse_at_center,rgba(228,228,231,0.09),transparent_70%)] blur-3xl" />
        <div className="absolute -left-40 top-1/3 h-[32rem] w-[32rem] rounded-full bg-[radial-gradient(circle,rgba(214,205,193,0.05),transparent_70%)] blur-3xl" />
        <div className="absolute -right-40 top-2/3 h-[32rem] w-[32rem] rounded-full bg-[radial-gradient(circle,rgba(180,188,200,0.05),transparent_70%)] blur-3xl" />
      </div>

      <div className="relative z-10">
        {/* Static rather than fixed: the picker popovers open downward into the
            page, and a floating header would be the one thing they scroll
            underneath. */}
        <header className="mx-auto mt-4 w-[min(1200px,calc(100%-2rem))]">
          <div className="relative flex items-center justify-between gap-4 rounded-2xl border-b border-white/10 bg-[#1D1D21]/40 px-4 py-3 shadow-[0_8px_32px_-12px_rgba(0,0,0,0.7)] backdrop-blur-xl backdrop-saturate-150 sm:px-5">
            <Link href="/" className="flex items-center gap-3">
              <span className="relative grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-white via-[#E4E4E7] to-[#A1A1AA] ring-1 ring-inset ring-white/40">
                <ArrowUpDown className="h-4 w-4 text-[#141416]" strokeWidth={2.75} />
              </span>
              <span className="flex flex-col leading-none">
                <span className="text-[15px] font-semibold tracking-tight text-white">
                  Invariant
                </span>
                <span className="mt-2 hidden text-[10px] uppercase tracking-[0.18em] text-white/40 sm:block">
                  Convert · Bridge · Cash out
                </span>
              </span>
            </Link>

            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-4 py-2 text-sm font-semibold text-white/70 transition-colors hover:border-white/30 hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Back to home</span>
            </Link>
          </div>
        </header>

        <main className="py-16 sm:py-24">
          <Converter />
        </main>

        <footer className="border-t border-white/[0.08] py-8">
          <p className="mx-auto w-[min(1200px,calc(100%-2rem))] text-center text-sm text-white/35">
            © {new Date().getFullYear()} Invariant Labs. Non-custodial. Audited.
          </p>
        </footer>
      </div>
    </div>
  );
}
