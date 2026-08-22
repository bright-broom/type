const CACHE_NAME = "typeloop-shell-2026-08-23-v6";
const RESTRICTED_LEGACY_CACHES = new Set(["typeloop-shell-2026-08-21-v3", "typeloop-shell-2026-08-21-v4"]);
const ROUTE_INVENTORY = "/application-routes.json";
const SHELL_ASSETS = [
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
  const inventoryResponse = await globalThis.fetch(ROUTE_INVENTORY);
  if (!inventoryResponse.ok) throw new Error("The application route inventory could not be fetched.");
  const applicationRoutes = await inventoryResponse.clone().json();
  if (
    !Array.isArray(applicationRoutes) ||
    applicationRoutes.length === 0 ||
    new Set(applicationRoutes).size !== applicationRoutes.length ||
    applicationRoutes.some((route) => typeof route !== "string" || !route.startsWith("/") || route.includes("?"))
  ) {
    throw new Error("The application route inventory is invalid.");
  }
  await cache.put(ROUTE_INVENTORY, inventoryResponse);
  const documents = await Promise.all(
    applicationRoutes.map(async (route) => {
      const response = await globalThis.fetch(route);
      if (!response.ok) throw new Error(`Required application route failed: ${route}`);
      await cache.put(route, response.clone());
      return response.text();
    }),
  );
  const assets = [
    ...new Set([
      ...SHELL_ASSETS,
      ...documents.flatMap((html) =>
        [...html.matchAll(/(?:src|href)="(\/_next\/static\/[^"]+)"/g)].map((match) => match[1]),
      ),
    ]),
  ];
  const discovered = new Set(assets);
  for (let index = 0; index < assets.length; index += 1) {
    const asset = assets[index];
    const response = await globalThis.fetch(asset);
    if (!response.ok) throw new Error(`Required shell asset failed: ${asset}`);
    await cache.put(asset, response.clone());
    if (!asset.endsWith(".js") && !asset.endsWith(".css")) continue;
    const source = await response.text();
    for (const match of source.matchAll(/(?:\/_next\/)?static\/chunks\/[a-zA-Z0-9._~-]+\.(?:js|css)/g)) {
      const dependency = match[0].startsWith("/_next/") ? match[0] : `/_next/${match[0]}`;
      if (discovered.has(dependency)) continue;
      discovered.add(dependency);
      assets.push(dependency);
    }
  }
}

async function installApplicationShell() {
  const existingCaches = await globalThis.caches.keys();
  await cacheApplicationShell();
  if (existingCaches.some((name) => RESTRICTED_LEGACY_CACHES.has(name))) {
    await globalThis.skipWaiting();
  }
}

async function cachedApplicationRoutes(cache) {
  const response = await cache.match(ROUTE_INVENTORY);
  if (!response) return new Set();
  try {
    const routes = await response.json();
    if (!Array.isArray(routes)) return new Set();
    return new Set(
      routes.filter((route) => typeof route === "string" && route.startsWith("/") && !route.includes("?")),
    );
  } catch {
    return new Set();
  }
}

globalThis.addEventListener("install", (event) => {
  event.waitUntil(installApplicationShell());
});

globalThis.addEventListener("activate", (event) => {
  event.waitUntil(
    globalThis.caches.keys().then(async (names) => {
      const retiresRestrictedShell = names.some((name) => RESTRICTED_LEGACY_CACHES.has(name));
      await Promise.all(
        names
          .filter((name) => name.startsWith("typeloop-shell-") && name !== CACHE_NAME)
          .map((name) => globalThis.caches.delete(name)),
      );
      await globalThis.clients.claim();
      if (!retiresRestrictedShell) return;
      const windows = await globalThis.clients.matchAll({ type: "window", includeUncontrolled: true });
      const freshRoot = new URL("/", globalThis.location.origin).href;
      await Promise.all(windows.map((client) => client.navigate(freshRoot)));
    }),
  );
});

async function networkFirst(request) {
  const cache = await globalThis.caches.open(CACHE_NAME);
  const url = new URL(request.url);
  const cacheKey = url.pathname;
  const applicationRoutes = await cachedApplicationRoutes(cache);
  try {
    const response = await globalThis.fetch(request);
    if (response.ok && applicationRoutes.has(cacheKey)) await cache.put(cacheKey, response.clone());
    return response;
  } catch {
    return (await cache.match(cacheKey)) ?? (await cache.match("/")) ?? Response.error();
  }
}

async function cacheFirst(request, event) {
  const cache = await globalThis.caches.open(CACHE_NAME);
  const cacheKey = new URL(request.url).pathname;
  const cached = await cache.match(cacheKey);
  if (!cached && cacheKey.startsWith("/_next/static/")) {
    return Response.error();
  }
  const refresh = globalThis
    .fetch(request)
    .then(async (response) => {
      if (response.ok) await cache.put(cacheKey, response.clone());
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
  if (
    url.pathname === ROUTE_INVENTORY ||
    url.pathname.startsWith("/_next/static/") ||
    SHELL_ASSETS.includes(url.pathname)
  ) {
    event.respondWith(cacheFirst(request, event));
  }
});
