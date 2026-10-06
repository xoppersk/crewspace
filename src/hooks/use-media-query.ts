"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Reactive matchMedia — used for responsive drawers (sheet vs bottom sheet).
 * Implemented with useSyncExternalStore so server rendering always sees
 * `false` and the client subscribes to changes.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    [query],
  );
  const getSnapshot = useCallback(() => window.matchMedia(query).matches, [query]);
  const getServerSnapshot = useCallback(() => false, []);
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** True below the md breakpoint — drawers become bottom sheets. */
export function useIsMobile(): boolean {
  return useMediaQuery("(max-width: 767px)");
}
