/**
 * /rates
 * ---------------------------------------------------------------------------
 * The live rate board. Stays a Server Component: the shell renders on the
 * server and only the board itself hydrates.
 */

import type { Metadata } from "next";

import RatesBoard from "@/components/rates/RatesBoard";
import ToolShell from "@/components/shell/ToolShell";

export const metadata: Metadata = {
  title: "Live rates · Invariant",
  description:
    "Live exchange rates for 16 cryptocurrencies and 20 world currencies, priced in any of them, with 24-hour moves.",
};

export default function RatesPage() {
  return (
    <ToolShell active="/rates">
      <RatesBoard />
    </ToolShell>
  );
}
