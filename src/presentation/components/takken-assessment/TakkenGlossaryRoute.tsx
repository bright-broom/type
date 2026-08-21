"use client";

import { TakkenGlossary } from "../takken/TakkenGlossary.tsx";

/**
 * Direct-route adapter for the statically cached application shell.
 *
 * A document navigation lets the service worker serve the inventoried route while
 * offline. Next's router would request an uncached RSC flight before changing the
 * screen, making these primary actions fail from the installed deep-link shortcut.
 */
export function TakkenGlossaryRoute() {
  return (
    <TakkenGlossary
      // The cached document navigation is the intentional offline boundary described above.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      onBack={() => window.location.assign("/takken")}
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      onStart={() => window.location.assign("/?training=takken")}
    />
  );
}
