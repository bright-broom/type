import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { runInNewContext } from "node:vm";

const ROOT = new URL("../", import.meta.url);
const file = (path) => new URL(path, ROOT);
const applicationRoutes = JSON.parse(await readFile(file("public/application-routes.json"), "utf8"));

test("a privacy-boundary upgrade purges restricted shells and navigates old clients", async () => {
  const source = await readFile(file("public/sw.js"), "utf8");
  const listeners = new Map();
  const deleted = [];
  const navigated = [];
  const lifecycle = [];
  let matchOptions;
  let claimed = false;
  let skippedWaiting = false;
  const legacyCaches = ["typeloop-shell-2026-08-21-v3", "typeloop-shell-2026-08-21-v4"];
  const context = {
    URL,
    Response,
    Set,
    console,
    location: { origin: "https://typeloop.example" },
    clients: {
      claim: async () => {
        claimed = true;
        lifecycle.push("claim");
      },
      matchAll: async (options) => {
        matchOptions = options;
        lifecycle.push("matchAll");
        return [
          {
            url: "https://typeloop.example/ais",
            navigate: async (url) => {
              navigated.push(url);
              lifecycle.push("navigate");
            },
          },
        ];
      },
    },
    skipWaiting: async () => {
      skippedWaiting = true;
      lifecycle.push("skipWaiting");
    },
    caches: {
      open: async () => ({ put: async () => undefined, match: async () => undefined }),
      keys: async () => legacyCaches,
      delete: async (name) => {
        deleted.push(name);
        lifecycle.push(`delete:${name}`);
        return true;
      },
    },
    fetch: async (resource) => {
      if (resource === "/application-routes.json") {
        return new Response(JSON.stringify(applicationRoutes), { status: 200 });
      }
      return new Response("ok", { status: 200 });
    },
    addEventListener: (name, listener) => listeners.set(name, listener),
  };
  context.globalThis = context;
  runInNewContext(source, context);

  let installation;
  listeners.get("install")({ waitUntil: (promise) => (installation = promise) });
  await installation;
  assert.equal(skippedWaiting, true);

  let activation;
  listeners.get("activate")({ waitUntil: (promise) => (activation = promise) });
  await activation;
  assert.deepEqual(deleted, legacyCaches);
  assert.equal(claimed, true);
  assert.equal(matchOptions.type, "window");
  assert.equal(matchOptions.includeUncontrolled, true);
  assert.deepEqual(Object.keys(matchOptions).sort(), ["includeUncontrolled", "type"]);
  assert.deepEqual(navigated, ["https://typeloop.example/"]);
  assert.deepEqual(lifecycle, [
    "skipWaiting",
    ...legacyCaches.map((name) => `delete:${name}`),
    "claim",
    "matchAll",
    "navigate",
  ]);
});
