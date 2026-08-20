import { readFile } from "node:fs/promises";

const [manifest, requiredStaticRoutes] = await Promise.all([
  readFile(".next/prerender-manifest.json", "utf8").then(JSON.parse),
  readFile("public/application-routes.json", "utf8").then(JSON.parse),
]);
if (!Array.isArray(requiredStaticRoutes) || new Set(requiredStaticRoutes).size !== requiredStaticRoutes.length) {
  console.error("The application route inventory must be a unique JSON array.");
  process.exit(1);
}
const staticRoutes = new Set(Object.keys(manifest.routes ?? {}));
const missing = requiredStaticRoutes.filter((route) => !staticRoutes.has(route));
if (missing.length > 0) {
  console.error(`Routes escaped the static shell contract:\n${missing.join("\n")}`);
  process.exit(1);
}
const undeclared = [...staticRoutes].filter(
  (route) => !route.startsWith("/_") && route !== "/manifest.webmanifest" && !requiredStaticRoutes.includes(route),
);
if (undeclared.length > 0) {
  console.error(`Static application routes are missing from the delivery inventory:\n${undeclared.join("\n")}`);
  process.exit(1);
}
const regenerating = requiredStaticRoutes.filter((route) => manifest.routes[route]?.initialRevalidateSeconds !== false);
if (regenerating.length > 0) {
  console.error(`Application routes must remain immutable prerenders:\n${regenerating.join("\n")}`);
  process.exit(1);
}
if (Object.keys(manifest.dynamicRoutes ?? {}).length > 0) {
  console.error("TypeLoop does not declare a dynamic route; the prerender manifest must remain deterministic.");
  process.exit(1);
}
const homeHtml = await readFile(".next/server/app/index.html", "utf8");
const bootstrapIndex = homeHtml.indexOf('src="/theme-bootstrap.js"');
const bodyIndex = homeHtml.indexOf("<body");
if (bootstrapIndex < 0 || bodyIndex < 0 || bootstrapIndex > bodyIndex) {
  console.error("The appearance bootstrap must remain parser-blocking in <head> before static application markup.");
  process.exit(1);
}
console.log(`Verified ${requiredStaticRoutes.length} CDN-prerendered application routes.`);
