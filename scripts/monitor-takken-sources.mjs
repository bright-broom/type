#!/usr/bin/env node

import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";
import registry from "../src/content/takken/takken-source-registry.json" with { type: "json" };
import edition from "../src/content/takken/takken-edition.json" with { type: "json" };
import { stableSerialize } from "./takken-governance-contract.mjs";

const OFFICIAL_HOSTS = new Set(["laws.e-gov.go.jp", "www.mlit.go.jp", "www.retio.or.jp"]);

export function assertOfficialMonitorUrl(rawUrl) {
  const url = new URL(rawUrl);
  if (
    url.protocol !== "https:" ||
    !OFFICIAL_HOSTS.has(url.hostname) ||
    url.username !== "" ||
    url.password !== "" ||
    url.port !== ""
  ) {
    throw new Error(`Official source URL is not allowlisted: ${rawUrl}`);
  }
  return url;
}

export function normalizeOfficialContent(format, raw) {
  if (format === "egov-json") return stableSerialize(JSON.parse(raw));
  return raw
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

export function sourceDigest(format, raw) {
  return createHash("sha256").update(normalizeOfficialContent(format, raw)).digest("hex");
}

export function extractOfficialContent(document, raw) {
  const normalized = normalizeOfficialContent(document.format, raw);
  if (!document.contentWindow) return normalized;
  const start = normalized.indexOf(document.contentWindow.startMarker);
  const end = normalized.indexOf(document.contentWindow.endMarker, start + document.contentWindow.startMarker.length);
  if (start < 0 || end < 0 || end <= start) return normalized;
  return normalized.slice(start, end).trim();
}

export function compareOfficialDocument(document, raw) {
  const normalized = extractOfficialContent(document, raw);
  const missingMarkers = document.expectedMarkers.filter((marker) => !normalized.includes(marker));
  const actualDigest = createHash("sha256").update(normalized).digest("hex");
  return {
    id: document.id,
    title: document.title,
    url: document.url,
    asOfDate: document.asOfDate,
    affectedSourceIds: document.affectedSourceIds ?? [],
    expectedDigest: document.digest,
    actualDigest,
    missingMarkers,
    changed: actualDigest !== document.digest || missingMarkers.length > 0,
  };
}

export function renderDriftReport(results, retrievedAt) {
  const changed = results.filter((result) => result.changed);
  const lines = [
    "<!-- typeloop-takken-source-drift -->",
    "# 宅建公式情報の差分を検出しました",
    "",
    `監視日時: ${retrievedAt}`,
    `試験基準日: ${edition.legalBasisDate}`,
    "",
    "自動公開は行いません。教材への影響を確認し、専門家レビューを経て更新してください。",
    "",
  ];
  for (const result of changed) {
    lines.push(`## ${result.title}`, "", `- 出典: ${result.url}`, `- 取得基準日: ${result.asOfDate}`);
    lines.push(
      `- 影響候補: ${result.affectedSourceIds.length > 0 ? result.affectedSourceIds.join(", ") : "試験日程・受験条件"}`,
    );
    lines.push(`- 登録digest: \`${result.expectedDigest}\``, `- 現在digest: \`${result.actualDigest}\``);
    if (result.missingMarkers.length > 0) lines.push(`- 欠落した確認語: ${result.missingMarkers.join(" / ")}`);
    lines.push("");
  }
  return `${lines.join("\n")}\n`;
}

export async function fetchOfficialDocument(document, fetchImpl = fetch) {
  const url = assertOfficialMonitorUrl(document.url);
  const response = await fetchImpl(url, {
    redirect: "manual",
    headers: { "User-Agent": "TypeLoop-official-source-monitor/1.0 (+https://github.com/bright-broom/type)" },
    signal: AbortSignal.timeout(30_000),
  });
  if (response.status >= 300 && response.status < 400) {
    throw new Error(`${document.id}: redirects are not allowed for official sources`);
  }
  if (!response.ok) throw new Error(`${document.id}: official source returned HTTP ${response.status}`);
  return response.text();
}

async function main() {
  const outputIndex = process.argv.indexOf("--output");
  const outputPath = outputIndex >= 0 ? process.argv[outputIndex + 1] : undefined;
  const ids = new Set(registry.watchDocumentIds);
  const documents = registry.documents
    .filter((document) => ids.has(document.id))
    .map((document) => ({
      ...document,
      affectedSourceIds: registry.sourceMappings
        .filter((mapping) => mapping.documentIds.includes(document.id))
        .map((mapping) => mapping.sourceId),
    }));
  const results = [];
  for (const document of documents) {
    results.push(compareOfficialDocument(document, await fetchOfficialDocument(document)));
  }
  const report = renderDriftReport(results, new Date().toISOString());
  if (outputPath) await writeFile(outputPath, report, "utf8");
  else process.stdout.write(report);
  const changed = results.filter((result) => result.changed);
  if (changed.length > 0) process.exitCode = 2;
  else console.log(`Verified ${results.length} official Takken sources without drift.`);
}

if (import.meta.filename === process.argv[1]) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
