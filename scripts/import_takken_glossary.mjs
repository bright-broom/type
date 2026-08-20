import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { canonicalDigest } from "./takken-governance-contract.mjs";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const shouldCheck = process.argv.includes("--check");
const explicitSourcePath = process.argv.slice(2).find((argument) => !argument.startsWith("--"));
const sourcePath = explicitSourcePath
  ? resolve(explicitSourcePath)
  : resolve(scriptDir, "../src/content/takken/source/takken-glossary.tsv");
const outputPath = resolve(scriptDir, "../src/content/generated/takken-glossary.json");
const editionPath = resolve(scriptDir, "../src/content/takken/takken-edition.json");
const registryPath = resolve(scriptDir, "../src/content/takken/takken-source-registry.json");
const edition = JSON.parse(await readFile(editionPath, "utf8"));
const registry = JSON.parse(await readFile(registryPath, "utf8"));
const raw = await readFile(sourcePath, "utf8");
const lines = raw.split(/\r?\n/);

const entries = lines
  .map((line) => line.split("\t"))
  .filter((columns) => /^\d+$/.test(columns[0] ?? ""))
  .map((columns) => ({
    id: Number(columns[0]),
    category: columns[1]?.trim() ?? "",
    subcategory: columns[2]?.trim() ?? "",
    term: columns[3]?.trim() ?? "",
    reading: columns[4]?.trim() ?? "",
    definition: columns[5]?.trim() ?? "",
    examNote: columns[6]?.trim() ?? "",
    law: columns[7]?.trim() ?? "",
    importance: columns[8]?.trim() ?? "",
    sourceId: columns[9]?.trim() ?? "",
    searchKeywords: columns[10]?.trim() ?? "",
  }));

if (entries.length !== 446) {
  throw new Error(`Expected 446 glossary entries, received ${entries.length}`);
}

for (const [index, entry] of entries.entries()) {
  if (entry.id !== index + 1) throw new Error(`Unexpected id ${entry.id} at position ${index + 1}`);
  for (const [key, value] of Object.entries(entry)) {
    if (key !== "id" && !value) throw new Error(`Entry ${entry.id} is missing ${key}`);
  }
}

const categories = [...new Set(entries.map((entry) => entry.category))];
const importanceLevels = [...new Set(entries.map((entry) => entry.importance))].sort(
  (a, b) => ["A", "B", "C"].indexOf(a) - ["A", "B", "C"].indexOf(b),
);
const sourceIds = [...new Set(entries.map((entry) => entry.sourceId))].sort((a, b) =>
  a.localeCompare(b, "ja", { numeric: true }),
);
const mappedSourceIds = registry.sourceMappings
  .map(({ sourceId }) => sourceId)
  .sort((a, b) => a.localeCompare(b, "ja", { numeric: true }));
if (JSON.stringify(mappedSourceIds) !== JSON.stringify(sourceIds)) {
  throw new Error(`Source registry does not cover the imported source IDs: ${sourceIds.join(", ")}`);
}
const sourceRegistryDigest = canonicalDigest(registry);
const sourceDigest = createHash("sha256").update(raw.replace(/\r\n/g, "\n")).digest("hex");

const glossary = {
  title: "宅建試験 完全用語一覧",
  edition: edition.label,
  examDate: edition.examDate,
  legalBasisDate: edition.legalBasisDate,
  version: 2,
  provenance: {
    sourceRegistryVersion: registry.schemaVersion,
    sourceRegistryDigest,
    sourceDigest,
    retrievedAt: registry.retrievedAt,
  },
  stats: { entryCount: entries.length },
  filters: { categories, importanceLevels, sourceIds },
  entries,
};

const output = `${JSON.stringify(glossary, null, 2)}\n`;
if (shouldCheck) {
  const current = await readFile(outputPath, "utf8");
  if (current !== output) {
    throw new Error("Generated Takken glossary is stale. Run npm run import:takken and commit the result.");
  }
  console.log(`Verified ${entries.length} generated Takken entries against ${sourcePath}`);
} else {
  await writeFile(outputPath, output, "utf8");
  console.log(`Imported ${entries.length} entries to ${outputPath}`);
}
