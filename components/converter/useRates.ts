"use client";

/**
 * useRates.ts
 * ---------------------------------------------------------------------------
 * Keeps the converter's price table live.
 *
 * Three things keep it current, and each covers a case the others miss:
 *   - a POLL, for a page sitting open and visible;
 *   - a VISIBILITY listener, because polling is suspended while the tab is
 *     hidden (a background tab burning a request every 30s for hours is the
 *     thing that gets an app rate-limited) and the rate is stale the moment the
 *     reader comes back;
 *   - a manual refresh, for the reader who wants to see the number move now.
 *
 * A failed refresh deliberately does NOT clear the rates already held. The last
 * good table plus a visible "stale" marker is more useful than an empty
 * converter, and network blips are common enough that dropping the numbers on
 * every one would make the page feel broken.
 */

import { useCallback, useEffect, useRef, useState } from "react";

import type { RatesPayload } from "@/lib/converter/assets";

/** Matches the route handler's own cache TTL — polling faster returns the
 *  same payload while spending the upstream rate limit. */
const POLL_MS = 30_000;

export interface RatesState {
  usdPerUnit: Record<string, number>;
  /** ms since epoch of the last successful upstream refresh; 0 before the first. */
  updatedAt: number;
  /** True during the very first load, when there is nothing to show yet. */
  loading: boolean;
  /** True while a background refresh is running over existing rates. */
  refreshing: boolean;
  /** Set when the most recent attempt failed; existing rates are kept. */
  error: string | null;
  /** Upstream is failing and the server is serving its last good copy. */
  stale: boolean;
  refresh: () => void;
}

export function useRates(): RatesState {
  const [usdPerUnit, setUsdPerUnit] = useState<Record<string, number>>({});
  const [updatedAt, setUpdatedAt] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stale, setStale] = useState(false);

  /*
    Guards an unmounted (or superseded) fetch from calling setState. Strict mode
    mounts effects twice in development, so without this the first run's
    in-flight request resolves against a torn-down component.
  */
  const aliveRef = useRef(true);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await fetch("/api/rates", { cache: "no-store" });
      if (!res.ok) throw new Error(`Rates unavailable (${res.status})`);

      const payload = (await res.json()) as RatesPayload;
      if (!aliveRef.current) return;

      setUsdPerUnit(payload.usdPerUnit);
      setUpdatedAt(payload.updatedAt);
      setStale(Boolean(payload.stale));
      setError(null);
    } catch (err) {
      if (!aliveRef.current) return;
      setError(err instanceof Error ? err.message : "Could not reach the rate feed");
    } finally {
      if (aliveRef.current) {
        setRefreshing(false);
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    aliveRef.current = true;
    void load();

    let timer: ReturnType<typeof setInterval> | null = null;

    const startPolling = () => {
      if (timer === null) timer = setInterval(() => void load(), POLL_MS);
    };
    const stopPolling = () => {
      if (timer !== null) {
        clearInterval(timer);
        timer = null;
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void load();
        startPolling();
      } else {
        stopPolling();
      }
    };

    if (document.visibilityState === "visible") startPolling();
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      aliveRef.current = false;
      stopPolling();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [load]);

  return {
    usdPerUnit,
    updatedAt,
    loading,
    refreshing,
    error,
    stale,
    refresh: () => void load(),
  };
}
