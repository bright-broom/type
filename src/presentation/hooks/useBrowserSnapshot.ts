"use client";

import { useSyncExternalStore } from "react";

const subscribeToNoEvents = () => () => undefined;

/**
 * Hydrate from the invariant server value, then read a stable primitive from the
 * browser without a mount effect. Callers keep mutable user choices in React state;
 * this hook only owns the initial browser-delivery snapshot.
 */
export function useBrowserSnapshot<T>(getSnapshot: () => T, serverSnapshot: T): T {
  return useSyncExternalStore(subscribeToNoEvents, getSnapshot, () => serverSnapshot);
}
