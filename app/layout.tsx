import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "Invariant · Live crypto and currency rates",
  description:
    "Live mid-market rates for 16 tokens and 20 world currencies. Convert between any two, or read the whole board.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.variable} bg-[#141416] antialiased`}>{children}</body>
    </html>
  );
}
