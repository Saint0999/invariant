/**
 * /converter
 * ---------------------------------------------------------------------------
 * The converter tool's route. Stays a Server Component: only the tool itself is
 * interactive, so the shell renders on the server and just the card hydrates.
 *
 * The charcoal frame lives in ToolShell, shared with /rates — see that file for
 * why it repeats the landing page's language rather than importing from it.
 */

import type { Metadata } from "next";

import Converter from "@/components/converter/Converter";
import ToolShell from "@/components/shell/ToolShell";

export const metadata: Metadata = {
  title: "Converter · Invariant",
  description:
    "Convert any cryptocurrency into another, or straight into dollars, euros, pounds and more, at live market rates.",
};

export default function ConverterPage() {
  return (
    <ToolShell active="/converter">
      <Converter />
    </ToolShell>
  );
}
