import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = resolve(root, "src/content/tokyo/tokyo-place-source.csv");
const overridePath = resolve(root, "src/content/tokyo/tokyo-place-reading-overrides.json");
const outputPath = resolve(root, "src/content/generated/tokyo-place-names.json");
const EXPECTED_SOURCE_SHA256 = "f003fd3d3190edff8794d4c951b12491bcbf58d04ea52a2069c059e156b8ef88";
const EXPECTED_COUNTS = {
  鉄道駅: 651,
  河川: 321,
  都市公園: 6127,
  山: 11,
  島: 22,
  市区町村: 63,
  行政名: 59,
};
const HEADER = "name,category,reading,reading_source,municipality,source,source_date";
const TYPABLE_READING = /^[ぁ-ゖーa-z0-9 ' -]+$/u;

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function stableId(category, name) {
  return `tokyo-place-${sha256(`${category}\0${name}`).slice(0, 16)}`;
}

function parseSource(source) {
  const [header, ...lines] = source.replace(/\r/g, "").trimEnd().split("\n");
  if (header !== HEADER) throw new Error("Tokyo source header changed");
  return lines.map((line, index) => {
    const fields = line.split(",");
    if (fields.length !== 7) throw new Error(`Invalid CSV row ${index + 2}`);
    const [name, category, reading, readingSource, municipality, sourceName, sourceDate] = fields;
    return { name, category, reading, readingSource, municipality, sourceName, sourceDate };
  });
}

function validateRows(rows) {
  const expectedTotal = Object.values(EXPECTED_COUNTS).reduce((sum, count) => sum + count, 0);
  if (rows.length !== expectedTotal) throw new Error(`Expected ${expectedTotal} rows, received ${rows.length}`);
  const keys = rows.map(({ category, name }) => `${category}\0${name}`);
  if (new Set(keys).size !== keys.length) throw new Error("Duplicate category/name pair");
  for (const [category, expected] of Object.entries(EXPECTED_COUNTS)) {
    const actual = rows.filter((row) => row.category === category).length;
    if (actual !== expected) throw new Error(`${category}: expected ${expected}, received ${actual}`);
  }
}

function applyOverrides(rows, overrides) {
  const byKey = new Map(overrides.map((row) => [`${row.category}\0${row.name}`, row]));
  const matched = new Set();
  const result = rows.map((row) => {
    const key = `${row.category}\0${row.name}`;
    const override = byKey.get(key);
    if (!override) return { ...row, reading: row.reading.replaceAll("・", " ") };
    matched.add(key);
    return { ...row, reading: override.reading, readingSource: override.basis };
  });
  if (matched.size !== byKey.size) throw new Error("Reading override does not match a source row");
  for (const row of result) {
    if (!row.name || !TYPABLE_READING.test(row.reading))
      throw new Error(`Untypable reading: ${row.name} / ${row.reading}`);
  }
  return result;
}

function buildCatalogue(source, rows) {
  const sourceFileSha256 = sha256(source);
  if (sourceFileSha256 !== EXPECTED_SOURCE_SHA256) throw new Error("Tokyo source snapshot changed");
  const categoryCounts = Object.fromEntries(
    Object.keys(EXPECTED_COUNTS).map((category) => [category, rows.filter((row) => row.category === category).length]),
  );
  return {
    source: {
      scope:
        "Tokyo railway stations, rivers, urban parks, mountains, islands, municipalities, and administrative names",
      retrievedOn: "2026-08-31",
      sourceFileSha256,
      readingPolicy:
        "Official readings where available; otherwise dictionary-generated and explicitly marked; reviewed overrides are tracked separately.",
    },
    stats: { entryCount: rows.length, categoryCounts },
    entries: rows.map((row) => [
      stableId(row.category, row.name),
      row.name,
      row.reading,
      row.category,
      row.readingSource,
    ]),
  };
}

const source = await readFile(sourcePath, "utf8");
const overrides = JSON.parse(await readFile(overridePath, "utf8"));
const parsed = parseSource(source);
validateRows(parsed);
const catalogue = buildCatalogue(source, applyOverrides(parsed, overrides));
const serialized = `${JSON.stringify(catalogue)}\n`;
if (process.argv.includes("--check")) {
  if ((await readFile(outputPath, "utf8")) !== serialized)
    throw new Error("Tokyo catalogue is stale; run npm run import:tokyo");
  console.log(`Verified ${catalogue.stats.entryCount} generated Tokyo place names.`);
} else {
  await writeFile(outputPath, serialized, "utf8");
  console.log(`Generated ${catalogue.stats.entryCount} Tokyo place names.`);
}
