import { useEffect, useMemo } from "react";
import type { UseQueryResult } from "@tanstack/react-query";

const TTL_MS = 7 * 24 * 60 * 60 * 1_000; // 7 days

export interface CacheResult<T> {
  /**
   * Resolved data following the three-tier priority:
   *   1. Fresh API response (query.data)
   *   2. localStorage cache from the last successful fetch
   *   3. undefined — caller should set isManualFallback to true
   */
  resolvedData: T | undefined;
  /** API failed but localStorage has valid cached data to show */
  isFromCache: boolean;
  /** API failed AND no valid cache — caller must render a manual text input */
  isManualFallback: boolean;
}

/**
 * Augments any TanStack Query result with a localStorage cache tier.
 *
 * Fallback chain:
 *   Tier 1 — Live API data          (query.data is filled)
 *   Tier 2 — localStorage snapshot  (isFromCache = true)
 *   Tier 3 — No data at all         (isManualFallback = true)
 *
 * @param cacheKey  A unique, stable identifier for localStorage (e.g. "leave-types")
 * @param query     The TanStack Query result to augment
 *
 * @example
 * const q = useQuery({ queryKey: ["leave-types"], queryFn: ... });
 * const { resolvedData, isFromCache, isManualFallback } = useWithCache("leave-types", q);
 * const types = resolvedData?.data ?? [];
 */
export function useWithCache<T>(
  cacheKey: string,
  query: Pick<UseQueryResult<T>, "data" | "isError">
): CacheResult<T> {
  const key = `hrms_v1_${cacheKey}`;

  // Tier 1 → 2: persist every successful API response to localStorage (best-effort)
  useEffect(() => {
    if (query.data !== undefined) {
      try {
        localStorage.setItem(key, JSON.stringify({ payload: query.data, ts: Date.now() }));
      } catch {
        // localStorage quota exceeded — cache is best-effort, ignore silently
      }
    }
  }, [query.data, key]);

  // Tier 2 → 3: on API failure, attempt to read a cached snapshot
  const cachedData = useMemo<T | undefined>(() => {
    if (!query.isError) return undefined;
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return undefined;
      const { payload, ts } = JSON.parse(raw) as { payload: T; ts: number };
      if (Date.now() - ts > TTL_MS) {
        localStorage.removeItem(key); // evict expired entry
        return undefined;
      }
      return payload;
    } catch {
      return undefined;
    }
  }, [query.isError, key]);

  return {
    resolvedData:     query.data ?? cachedData,
    isFromCache:      query.isError && cachedData !== undefined,
    isManualFallback: query.isError && cachedData === undefined,
  };
}
