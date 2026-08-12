/**
 * RateAttribution.tsx
 * ---------------------------------------------------------------------------
 * "Rates by CoinGecko", with a link out. Every price on this site — the
 * converter, the board, the charts, the landing page's sample series — comes
 * from that one upstream, and saying so is both the honest thing and the
 * provider's attribution ask.
 *
 * A component rather than a copied line because it appears in two footers that
 * are deliberately NOT shared (see ToolShell's header comment): the landing
 * page keeps its own frame, so the only way to stop the wording drifting
 * between the two was to share the sentence itself.
 *
 * No "use client" — it renders no state, so it stays server-renderable inside
 * ToolShell and simply rides along in the landing bundle.
 */

import { ExternalLink } from "lucide-react";
import type { FC } from "react";

const RateAttribution: FC = () => (
  <span className="inline-flex items-center gap-1.5">
    Rates by
    {/*
      noreferrer alongside noopener: this is the one outbound link on the site,
      and there is no reason to hand the destination the page it came from.
    */}
    <a
      href="https://www.coingecko.com"
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 font-semibold text-white/55 transition-colors hover:text-white"
    >
      CoinGecko
      <ExternalLink className="h-3 w-3" aria-hidden />
      {/* The icon is decorative, so the "opens in a new tab" fact has to reach
          a screen reader some other way. */}
      <span className="sr-only">(opens in a new tab)</span>
    </a>
  </span>
);

export default RateAttribution;
