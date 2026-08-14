import assert from "node:assert/strict";
import test from "node:test";
import glossaryJson from "./takken-glossary.json" with { type: "json" };
import type { TakkenGlossary } from "./takken-glossary-types.ts";
import { TAKKEN_PROMPTS } from "../prompts/takken-prompts.ts";
import { validatePrompts } from "../prompts/validate-prompts.ts";
import { filterTakkenGlossary } from "./filter-takken-glossary.ts";

const glossary = glossaryJson as TakkenGlossary;

test("imports all 446 takken glossary entries and filter values", () => {
  assert.equal(glossary.stats.entryCount, 446);
  assert.equal(glossary.entries.length, 446);
  assert.deepEqual(glossary.filters.categories, ["権利関係", "税・その他", "宅建業法", "法令上の制限"]);
  assert.deepEqual(glossary.filters.importanceLevels, ["A", "B", "C"]);
  assert.equal(glossary.filters.sourceIds.length, 17);
  assert.deepEqual(glossary.entries.map((entry) => entry.id), Array.from({ length: 446 }, (_, index) => index + 1));
});

test("every takken glossary entry is available as a valid typing prompt", () => {
  assert.equal(TAKKEN_PROMPTS.length, 446);
  assert.deepEqual(validatePrompts(TAKKEN_PROMPTS, { allowDuplicateText: true }), []);
  assert.equal(new Set(TAKKEN_PROMPTS.map((prompt) => prompt.id)).size, 446);
});

test("filters by keyword, field, importance, and source id", () => {
  const filtered = filterTakkenGlossary(glossary.entries, {
    query: "抵当権",
    category: "権利関係",
    importance: "A",
    sourceId: "S02",
  });
  assert.ok(filtered.length > 0);
  assert.ok(filtered.every((entry) => entry.category === "権利関係" && entry.importance === "A" && entry.sourceId === "S02"));
  assert.ok(filtered.some((entry) => `${entry.term} ${entry.definition} ${entry.searchKeywords}`.includes("抵当権")));
});
