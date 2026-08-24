export const PRODUCTION_FETCH_TIMEOUT_MS = 20_000;
const MAX_DOCUMENT_BYTES = 5 * 1024 * 1024;

async function readBodyLimited(response) {
  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_DOCUMENT_BYTES) {
    throw new Error("Production document exceeds the byte limit");
  }
  if (!response.body) return new Uint8Array();
  const reader = response.body.getReader();
  const chunks = [];
  let length = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > MAX_DOCUMENT_BYTES) {
      await reader.cancel();
      throw new Error("Production document exceeds the byte limit");
    }
    chunks.push(value);
  }
  const combined = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return combined;
}

function bodyIsTextual(path, contentType) {
  return (
    !/^(?:image|audio|video)\//.test(contentType) &&
    !contentType.includes("font") &&
    !contentType.includes("octet-stream") &&
    !/\.(?:png|jpe?g|gif|webp|ico|woff2?)(?:\?|$)/i.test(path)
  );
}

function expectedAssetContentType(path) {
  const pathname = new URL(path, "https://asset.invalid").pathname;
  if (pathname.endsWith(".js")) return "javascript";
  if (pathname.endsWith(".css")) return "text/css";
  if (pathname.endsWith(".json") || pathname.endsWith(".webmanifest")) return "json";
  if (pathname.endsWith(".svg")) return "image/svg+xml";
  if (pathname.endsWith(".png")) return "image/png";
  return undefined;
}

function headerValue(headers, name) {
  const entry = Object.entries(headers).find(([key]) => key.toLowerCase() === name.toLowerCase());
  return typeof entry?.[1] === "string" ? entry[1] : "";
}

export async function fetchProductionDocument(origin, path, fetchImpl, overallSignal) {
  const url = new URL(path, origin);
  if (url.origin !== origin.origin) throw new Error("Production request escaped the canonical origin");
  const requestSignal = AbortSignal.timeout(PRODUCTION_FETCH_TIMEOUT_MS);
  const response = await fetchImpl(url, {
    redirect: "manual",
    headers: { Accept: "text/html,application/json,text/css,application/javascript;q=0.9,*/*;q=0.8" },
    signal: overallSignal ? AbortSignal.any([overallSignal, requestSignal]) : requestSignal,
  });
  const redirected = response.status >= 300 && response.status < 400;
  const body = !redirected ? await readBodyLimited(response) : new Uint8Array();
  if (redirected) await response.body?.cancel().catch(() => undefined);
  const headers = Object.fromEntries(response.headers.entries());
  const contentType = headerValue(headers, "content-type").toLowerCase();
  return {
    status: response.status,
    redirected,
    text: bodyIsTextual(path, contentType) ? new TextDecoder().decode(body) : "",
    bodyBytes: body.byteLength,
    expectedContentType: expectedAssetContentType(path),
    headers,
  };
}

export function referencedAssetPaths(html, origin) {
  const paths = [];
  for (const match of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
    const url = new URL(match[1], origin);
    if (url.origin !== origin.origin) continue;
    if (url.pathname.startsWith("/_next/static/") || url.pathname === "/theme-bootstrap.js") {
      paths.push(`${url.pathname}${url.search}`);
    }
  }
  return paths;
}

export function referencedChunkPaths(source) {
  return [...source.matchAll(/(?:\/_next\/)?static\/chunks\/[a-zA-Z0-9._~-]+\.(?:js|css)/g)].map(([value]) =>
    value.startsWith("/_next/") ? value : `/_next/${value}`,
  );
}

export function serviceWorkerShellAssetPaths(source) {
  const declarations = [...source.matchAll(/(?:^|\n)const SHELL_ASSETS = (\[[\s\S]*?\]);/g)];
  if (declarations.length !== 1) {
    throw new Error("Service Worker shell asset inventory is missing or duplicated");
  }
  const encoded = declarations[0][1];
  const listBody = encoded.slice(1, -1);
  const remainder = listBody.replace(/"[^"\\]*"/g, "").replace(/[\s,]/g, "");
  if (remainder !== "") throw new Error("Service Worker shell asset inventory is invalid");
  const assets = [...listBody.matchAll(/"([^"\\]*)"/g)].map((match) => match[1]);
  if (
    assets.length === 0 ||
    assets.length > 50 ||
    new Set(assets).size !== assets.length ||
    assets.some((path) => {
      const url = new URL(path, "https://shell.invalid");
      const hasControlCharacter = [...path].some((character) => {
        const codePoint = character.codePointAt(0);
        return codePoint !== undefined && (codePoint <= 31 || codePoint === 127);
      });
      return (
        !path.startsWith("/") ||
        path.startsWith("//") ||
        hasControlCharacter ||
        path.includes("?") ||
        path.includes("#") ||
        path.includes("..") ||
        url.origin !== "https://shell.invalid" ||
        `${url.pathname}${url.search}${url.hash}` !== path
      );
    })
  ) {
    throw new Error("Service Worker shell asset inventory is invalid");
  }
  return assets;
}
