"use client";

/**
 * AssetSelect.tsx
 * ---------------------------------------------------------------------------
 * The currency picker used on both sides of the converter: a trigger showing
 * the current asset, and a searchable popover listing everything else.
 *
 * A native <select> would have been less code, but it cannot show the chain
 * marks, and on desktop it renders a system-styled list that has nothing to do
 * with the charcoal theme. This is the same glass surface as the rest of the
 * page, so the picker reads as part of the card rather than as an OS control.
 */

import Image from "next/image";
import { useEffect, useMemo, useRef, useState, type FC } from "react";
import { Check, ChevronDown, Search } from "lucide-react";

import { ASSETS, type Asset } from "@/lib/converter/assets";

/**
 * The asset's mark, or a lettered chip when it has no SVG under /public.
 *
 * The fallback is not a placeholder to be replaced later — fiat has no logo by
 * nature, and a missing-image icon next to "US Dollar" would read as broken.
 */
export const AssetMark: FC<{ asset: Asset; className?: string }> = ({
  asset,
  className = "h-7 w-7",
}) => {
  if (asset.logo) {
    return (
      /* `unoptimized` for the same reason as the landing page: Next's image
         optimizer refuses SVGs unless dangerouslyAllowSVG is set. Decorative —
         the ticker is always rendered beside it. */
      <Image
        src={asset.logo}
        alt=""
        width={28}
        height={28}
        unoptimized
        className={"shrink-0 object-contain " + className}
      />
    );
  }

  return (
    <span
      aria-hidden
      className={
        "grid shrink-0 place-items-center rounded-full bg-white/[0.08] text-[0.65em] font-semibold tracking-tight text-white/70 ring-1 ring-inset ring-white/10 " +
        className
      }
    >
      {/*
        Fiat gets its currency symbol; crypto without a mark gets ONE letter.
        Three letters reads as a broken truncation when the ticker sits right
        beside it — "LIN" next to "LINK", "TRX" next to "TRX" — where a single
        initial reads as what it is, an avatar standing in for a missing logo.
      */}
      {asset.symbol ?? asset.code.slice(0, 1)}
    </span>
  );
};

interface AssetSelectProps {
  value: string;
  onChange: (code: string) => void;
  /** Code selected on the other side, marked as "in use" rather than hidden. */
  counterpart?: string;
  label: string;
}

const AssetSelect: FC<AssetSelectProps> = ({ value, onChange, counterpart, label }) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const selected = ASSETS.find((a) => a.code === value) ?? ASSETS[0];

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matches = q
      ? ASSETS.filter(
          (a) => a.code.toLowerCase().includes(q) || a.name.toLowerCase().includes(q),
        )
      : ASSETS;

    return {
      crypto: matches.filter((a) => a.kind === "crypto"),
      fiat: matches.filter((a) => a.kind === "fiat"),
    };
  }, [query]);

  /*
    Close on an outside click or Escape. Both listeners are attached only while
    the popover is open — a document-level mousedown handler that runs on every
    click in the app for the 99% of the time the picker is shut is exactly the
    kind of thing that piles up when there are two of these on the page.
  */
  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  // Focus the search box on open, and clear a stale query on close so the list
  // is never filtered by something typed a minute ago.
  useEffect(() => {
    if (open) searchRef.current?.focus();
    else setQuery("");
  }, [open]);

  const renderGroup = (heading: string, items: Asset[]) => {
    if (items.length === 0) return null;

    return (
      <div className="py-1">
        <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/35">
          {heading}
        </p>
        {items.map((asset) => {
          const isSelected = asset.code === value;
          const isCounterpart = asset.code === counterpart;

          return (
            <button
              key={asset.code}
              type="button"
              role="option"
              aria-selected={isSelected}
              onClick={() => {
                onChange(asset.code);
                setOpen(false);
              }}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors hover:bg-white/[0.07] focus-visible:bg-white/[0.07] focus-visible:outline-none"
            >
              <AssetMark asset={asset} className="h-7 w-7" />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold tracking-tight text-white">
                  {asset.code}
                </span>
                <span className="block truncate text-xs text-white/45">{asset.name}</span>
              </span>
              {isSelected && <Check className="h-4 w-4 shrink-0 text-white/70" />}
              {!isSelected && isCounterpart && (
                <span className="shrink-0 text-[10px] uppercase tracking-[0.16em] text-white/30">
                  in use
                </span>
              )}
            </button>
          );
        })}
      </div>
    );
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`${label}: ${selected.name}`}
        className="flex w-full items-center gap-2.5 rounded-2xl border border-white/10 bg-white/[0.06] px-3 py-2.5 text-left transition-colors hover:border-white/25 hover:bg-white/[0.1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 sm:px-3.5"
      >
        <AssetMark asset={selected} className="h-7 w-7" />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold tracking-tight text-white">
            {selected.code}
          </span>
          <span className="block truncate text-[11px] text-white/40">{selected.name}</span>
        </span>
        <ChevronDown
          className={
            "h-4 w-4 shrink-0 text-white/45 transition-transform duration-200 " +
            (open ? "rotate-180" : "")
          }
        />
      </button>

      {open && (
        /*
          z-30 keeps the popover above the swap button and the sibling row, both
          of which sit in the same stacking context. It stays under the fixed
          header (z-50) on purpose — a list that paints over the navbar reads as
          a detached overlay.
        */
        <div
          role="listbox"
          aria-label={label}
          className="absolute left-0 right-0 z-30 mt-2 overflow-hidden rounded-2xl border border-white/10 bg-[#1D1D21]/95 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.9)] backdrop-blur-xl backdrop-saturate-150"
        >
          <div className="flex items-center gap-2 border-b border-white/10 px-3 py-2.5">
            <Search className="h-4 w-4 shrink-0 text-white/35" />
            <input
              ref={searchRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search currencies"
              className="w-full bg-transparent text-sm text-white placeholder:text-white/30 focus:outline-none"
            />
          </div>

          <div className="max-h-72 overflow-y-auto p-1.5">
            {renderGroup("Crypto", results.crypto)}
            {renderGroup("Fiat", results.fiat)}
            {results.crypto.length === 0 && results.fiat.length === 0 && (
              <p className="px-3 py-6 text-center text-sm text-white/40">
                No currency matches “{query}”.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AssetSelect;
