export type AppOverlay = "none" | "history" | "playbook" | "takken" | "ais" | "settings";

export const OVERLAY_PATH: Record<AppOverlay, string> = {
  none: "/",
  history: "/history",
  playbook: "/consulting",
  takken: "/takken/glossary",
  ais: "/ais",
  settings: "/settings",
};

export type ReferenceRouteState = {
  typeloopOverlay?: AppOverlay;
  typeloopReturnFocusKey?: string;
};

export function overlayFromPathname(pathname: string): AppOverlay {
  const match = Object.entries(OVERLAY_PATH).find(([, path]) => path === pathname);
  return (match?.[0] as AppOverlay | undefined) ?? "none";
}

export function returnFocusKeyFromState(state: unknown): string | null {
  if (!state || typeof state !== "object") return null;
  const key = (state as ReferenceRouteState).typeloopReturnFocusKey;
  return typeof key === "string" ? key : null;
}
