"use client";

/**
 * useHistory.ts
 * ---------------------------------------------------------------------------
 * Loads one asset's price history for the expanded row.
 *
 * Deliberately NOT polled. Spot prices are polled every 30s because a live
 * quote is the point; a 7-day chart whose newest sample is an hour old by
 * construction gains nothing from being refetched, and this endpoint is the
 * easy one to rate-limit — one request per row opened, shared with nobody.
 * It loads when a row opens and when the window or base changes, and that is
 * all.
 */

import { useEffect, useState } from "react";

import type { HistoryPoint } from "./PriceChart";

export interface History {
  points: HistoryPoint[];
  low: number;
  high: number;
  /** Percent move across the requested window, not the row's 24h figure. */
  change: number;
  stale?: boolean;
}

export interface HistoryState {
  data: History | null;
  loading: boolean;
  error: string | null;
}

export function useHistory(
  code: string | null,
  base: string,
  days: number,
): HistoryState {
  const [state, setState] = useState<HistoryState>({
    data: null,
    loading: false,
    error: null,
  });

  useEffect(() => {
    if (!code) {
      setState({ data: null, loading: false, error: null });
      return;
    }

    /*
      Abort on change rather than letting the old request land. Switching
      windows quickly (24h → 7d → 30d) would otherwise race, and the slowest
      response wins — which on a rate-limited upstream is reliably the wrong
      one, since the failing request is the slow one.
    */
    const controller = new AbortController();
    setState((prev) => ({ ...prev, loading: true, error: null }));

    const params = new URLSearchParams({ code, base, days: String(days) });

    fetch(`/api/history?${params}`, { signal: controller.signal })
      .then(async (res) => {
        const payload = await res.json();
        if (!res.ok) throw new Error(payload?.error ?? `History unavailable (${res.status})`);
        return payload as History;
      })
      .then((data) => setState({ data, loading: false, error: null }))
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setState({
          data: null,
          loading: false,
          error: error instanceof Error ? error.message : "Could not load history",
        });
      });

    return () => controller.abort();
  }, [code, base, days]);

  return state;
}
