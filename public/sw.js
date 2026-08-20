const CACHE_NAME = "typeloop-shell-2026-08-21-v3";
const SHELL_ASSETS = [
  "/",
  "/manifest.webmanifest",
  "/favicon.svg",
  "/apple-touch-icon.png",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-maskable-512.png",
  "/theme-bootstrap.js",
];

async function cacheApplicationShell() {
  const cache = await globalThis.caches.open(CACHE_NAME);
  const rootResponse = await globalThis.fetch("/");
  if (!rootResponse.ok) throw new Error("The application shell could not be fetched.");

  await cache.put("/", rootResponse.clone());
  const html = await rootResponse.text();
  const nextAssets = [...html.matchAll(/(?:src|href)="(\/_next\/static\/[^"]+)"/g)].map((match) => match[1]);
  const assets = [...new Set([...SHELL_ASSETS.filter((asset) => asset !== "/"), ...nextAssets])];
  await Promise.all(
    assets.map(async (asset) => {
      const response = await globalThis.fetch(asset);
      if (!response.ok) throw new Error(`Required shell asset failed: ${asset}`);
      await cache.put(asset, response);
    }),
  );
}

globalThis.addEventListener("install", (event) => {
  event.waitUntil(cacheApplicationShell());
});

globalThis.addEventListener("activate", (event) => {
  event.waitUntil(
    globalThis.caches
      .keys()
      .then((names) =>
        Promise.all(
          names
            .filter((name) => name.startsWith("typeloop-shell-") && name !== CACHE_NAME)
            .map((name) => globalThis.caches.delete(name)),
        ),
      )
      .then(() => globalThis.clients.claim()),
  );
});

async function networkFirst(request) {
  const cache = await globalThis.caches.open(CACHE_NAME);
  try {
    const response = await globalThis.fetch(request);
    if (response.ok) await cache.put(request, response.clone());
    return response;
  } catch {
    return (await cache.match(request)) ?? (await cache.match("/")) ?? Response.error();
  }
}

async function cacheFirst(request, event) {
  const cache = await globalThis.caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  const refresh = globalThis
    .fetch(request)
    .then(async (response) => {
      if (response.ok) await cache.put(request, response.clone());
      return response;
    })
    .catch(() => null);
  if (cached) {
    event.waitUntil(refresh);
    return cached;
  }
  return (await refresh) ?? Response.error();
}

globalThis.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== globalThis.location.origin) return;
  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request));
    return;
  }
  if (url.pathname.startsWith("/_next/static/") || SHELL_ASSETS.includes(url.pathname)) {
    event.respondWith(cacheFirst(request, event));
  }
});
