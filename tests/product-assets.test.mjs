import assert from "node:assert/strict";
import { readdir, readFile, stat } from "node:fs/promises";
import { relative } from "node:path";
import test from "node:test";
import { runInNewContext } from "node:vm";

const ROOT = new URL("../", import.meta.url);
const file = (path) => new URL(path, ROOT);

function pngDimensions(bytes) {
  assert.equal(bytes.subarray(1, 4).toString("ascii"), "PNG");
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

function jpegDimensions(bytes) {
  let offset = 2;
  while (offset < bytes.length) {
    if (bytes[offset] !== 0xff) throw new Error("Invalid JPEG marker");
    const marker = bytes[offset + 1];
    const length = bytes.readUInt16BE(offset + 2);
    if (marker >= 0xc0 && marker <= 0xc3) {
      return { width: bytes.readUInt16BE(offset + 7), height: bytes.readUInt16BE(offset + 5) };
    }
    offset += 2 + length;
  }
  throw new Error("JPEG dimensions were not found");
}

async function filesBelow(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  return (
    await Promise.all(
      entries.map((entry) => {
        const child = new URL(`${entry.name}${entry.isDirectory() ? "/" : ""}`, directory);
        return entry.isDirectory() ? filesBelow(child) : [child];
      }),
    )
  ).flat();
}

test("browser chrome colors stay synchronized with the design registry", async () => {
  const colors = JSON.parse(await readFile(file("src/presentation/theme/browser-theme-colors.generated.json"), "utf8"));
  const themes = await readFile(file("app/styles/themes.css"), "utf8");
  const basePaper = themes.match(/^:root \{[\s\S]*?--paper: (#[0-9a-f]+);/im)?.[1];
  const noirPaper = themes.match(/:root\[data-theme="noir"\] \{[\s\S]*?--paper: (#[0-9a-f]+);/i)?.[1];
  assert.deepEqual(colors, { dark: noirPaper, light: basePaper });
});

test("the pre-paint bootstrap owns no palette and recognizes every appearance value", async () => {
  const source = await readFile(file("public/theme-bootstrap.js"), "utf8");
  assert.doesNotMatch(source, /#[0-9a-f]{3,8}\b/i);
  for (const value of ["noir", "modern", "classic", "comfortable", "compact", "system", "reduced"]) {
    assert.match(source, new RegExp(`"${value}"`));
  }
});

test("social and install assets have exact dimensions and bounded weight", async () => {
  const assets = [
    ["public/og.jpg", { width: 1200, height: 630 }, 150 * 1024, jpegDimensions],
    ["public/apple-touch-icon.png", { width: 180, height: 180 }, 64 * 1024, pngDimensions],
    ["public/icons/icon-192.png", { width: 192, height: 192 }, 64 * 1024, pngDimensions],
    ["public/icons/icon-512.png", { width: 512, height: 512 }, 64 * 1024, pngDimensions],
    ["public/icons/icon-maskable-512.png", { width: 512, height: 512 }, 64 * 1024, pngDimensions],
  ];

  for (const [path, expected, budget, dimensions] of assets) {
    const bytes = await readFile(file(path));
    assert.deepEqual(dimensions(bytes), expected, `${path} dimensions`);
    assert.ok((await stat(file(path))).size <= budget, `${path} exceeds ${budget} bytes`);
  }
});

test("the service worker is a same-origin, navigation-safe enhancement", async () => {
  const source = await readFile(file("public/sw.js"), "utf8");
  assert.match(source, /request\.method !== "GET"/);
  assert.match(source, /url\.origin !== globalThis\.location\.origin/);
  assert.match(source, /request\.mode === "navigate"/);
  assert.match(source, /cache\.match\("\/"\)/);
  assert.match(source, /Required shell asset failed/);
  assert.doesNotMatch(source, /skipWaiting/);
  assert.doesNotMatch(source, /https?:\/\//);
});

test("a partial shell fetch rejects service-worker installation", async () => {
  const source = await readFile(file("public/sw.js"), "utf8");
  const listeners = new Map();
  const writes = [];
  const context = {
    URL,
    Response,
    Set,
    console,
    location: { origin: "https://typeloop.example" },
    clients: { claim: async () => undefined },
    caches: {
      open: async () => ({
        put: async (key) => writes.push(String(key)),
        match: async () => undefined,
      }),
      keys: async () => [],
      delete: async () => true,
    },
    fetch: async (resource) =>
      resource === "/icons/icon-512.png"
        ? new Response("failed", { status: 500 })
        : new Response(resource === "/" ? '<script src="/_next/static/chunks/app.js"></script>' : "ok", {
            status: 200,
          }),
    addEventListener: (name, listener) => listeners.set(name, listener),
  };
  context.globalThis = context;
  runInNewContext(source, context);
  let installation;
  listeners.get("install")({ waitUntil: (promise) => (installation = promise) });
  await assert.rejects(installation, /Required shell asset failed: \/icons\/icon-512\.png/);
  assert.ok(writes.includes("/"), "the root response was staged before the required asset failed");
});

test("authored CSS cannot introduce informative text below 11px", async () => {
  const roots = [file("app/"), file("src/")];
  const minimumPx = 11;
  const violations = [];
  for (const root of roots) {
    for (const stylesheet of await filesBelow(root)) {
      if (!stylesheet.pathname.endsWith(".css")) continue;
      const source = await readFile(stylesheet, "utf8");
      for (const match of source.matchAll(/font-size\s*:\s*([^;]+)/g)) {
        for (const size of match[1].matchAll(/([0-9]*\.?[0-9]+)(px|rem)\b/g)) {
          const pixels = Number(size[1]) * (size[2] === "rem" ? 16 : 1);
          if (pixels < minimumPx) {
            violations.push(`${relative(ROOT.pathname, stylesheet.pathname)}: ${match[0].trim()}`);
          }
        }
      }
    }
  }
  assert.deepEqual(violations, []);
});
