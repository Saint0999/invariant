import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "Invariant — Instant crypto to fiat, any chain",
  description: "Cross-chain swaps and crypto-to-fiat payouts on one route.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.variable} bg-[#141416] antialiased`}>{children}</body>
    </html>
  );
}
