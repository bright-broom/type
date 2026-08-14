import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const sourcePath = process.argv[2];
if (!sourcePath) {
  throw new Error("Usage: npm run import:takken -- /path/to/takken-glossary.tsv");
}

const scriptDir = dirname(fileURLToPath(import.meta.url));
const outputPath = resolve(scriptDir, "../src/content/takken/takken-glossary.json");
const raw = await readFile(resolve(sourcePath), "utf8");
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
const importanceLevels = [...new Set(entries.map((entry) => entry.importance))]
  .sort((a, b) => ["A", "B", "C"].indexOf(a) - ["A", "B", "C"].indexOf(b));
const sourceIds = [...new Set(entries.map((entry) => entry.sourceId))].sort((a, b) =>
  a.localeCompare(b, "ja", { numeric: true }),
);

const glossary = {
  title: "宅建試験 完全用語一覧",
  edition: "令和8年度試験向け",
  version: 1,
  stats: { entryCount: entries.length },
  filters: { categories, importanceLevels, sourceIds },
  entries,
};

await writeFile(outputPath, `${JSON.stringify(glossary, null, 2)}\n`, "utf8");
console.log(`Imported ${entries.length} entries to ${outputPath}`);
