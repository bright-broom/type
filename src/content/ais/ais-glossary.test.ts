import assert from "node:assert/strict";
import test from "node:test";
import glossaryJson from "../generated/ais-glossary.json" with { type: "json" };
import type { AisGlossary } from "./ais-glossary-types.ts";
import { AIS_PROMPTS } from "../prompts/ais-prompts.ts";
import { validatePrompts } from "../prompts/validate-prompts.ts";
import { filterAisGlossary } from "./filter-ais-glossary.ts";

const glossary = glossaryJson as AisGlossary;
const ENTRY_COUNT = 154;

// The published artifact must never carry a quoted amount, deal count, or
// probability delta from the meeting. These mirror the importer's redaction
// rules so a hand-edited artifact fails here instead of shipping.
const FIGURE_PATTERNS = [/約?\d[\d,]*(?:億|万)?円/, /約?\d[\d,]*件/, /\d+(?:\.\d+)?\s*[%％]/];

function allText(): string {
  return glossary.entries
    .flatMap((entry) => [entry.term, entry.englishName, entry.definition, entry.meetingContext, entry.reviewQuestion])
    .join("\n");
}

test("imports every term with its joined category, context, and review state", () => {
  assert.equal(glossary.stats.entryCount, ENTRY_COUNT);
  assert.equal(glossary.entries.length, ENTRY_COUNT);
  assert.deepEqual(
    glossary.entries.map((entry) => entry.id),
    Array.from({ length: ENTRY_COUNT }, (_, index) => index + 1),
  );
  assert.equal(glossary.meeting.date, "2026-08-17");
  assert.deepEqual(glossary.filters.confidenceLevels, ["確定", "一部要確認", "要確認"]);
  assert.equal(glossary.filters.categories.length, 27);
  for (const entry of glossary.entries) {
    assert.match(entry.termId, /^TERM-\d{4}$/);
    assert.ok(entry.term && entry.reading && entry.definition, `${entry.termId} is missing core text`);
    assert.ok(entry.categories.length > 0, `${entry.termId} has no atomic category`);
    assert.ok(glossary.filters.termKinds.includes(entry.termKind));
  }
});

test("de-identified entries expose a pseudonym instead of a real party", () => {
  const masked = glossary.entries.filter((entry) => entry.masked);
  assert.equal(masked.length, glossary.stats.maskedEntryCount);
  assert.ok(masked.length > 0);
  for (const entry of masked) {
    assert.match(entry.term, /^(?:顧客|担当者)[A-Z]$/);
    assert.equal(entry.englishName, "-");
    assert.match(entry.definition, /公開ビルドでは実名を伏せています/);
  }
  assert.equal(new Set(masked.map((entry) => entry.term)).size, masked.length);
});

test("no meeting figure survives in the published artifact", () => {
  const text = allText();
  for (const pattern of FIGURE_PATTERNS) {
    assert.equal(pattern.test(text), false, `Unredacted figure matching ${pattern}`);
  }
  assert.ok(Object.values(glossary.masking.redactionCounts).reduce((total, count) => total + count, 0) > 0);
});

test("every AIS term is available as a valid typing prompt", () => {
  assert.equal(AIS_PROMPTS.length, ENTRY_COUNT);
  assert.deepEqual(validatePrompts(AIS_PROMPTS), []);
  assert.equal(new Set(AIS_PROMPTS.map((prompt) => prompt.id)).size, ENTRY_COUNT);
});

test("filters by keyword, atomic category, confidence, kind, and review state", () => {
  const sales = filterAisGlossary(glossary.entries, { category: "営業" });
  assert.ok(sales.length > 0);
  assert.ok(sales.every((entry) => entry.categories.includes("営業")));

  const pending = filterAisGlossary(glossary.entries, { pendingReviewOnly: true });
  assert.ok(pending.length > 0);
  assert.ok(pending.every((entry) => entry.confidence !== "確定"));

  const keyword = filterAisGlossary(glossary.entries, { query: "ぱいぷらいん" });
  assert.ok(keyword.some((entry) => entry.term === "パイプライン"));

  const narrowed = filterAisGlossary(glossary.entries, {
    category: "営業",
    confidence: "要確認",
    termKind: "社内用語",
  });
  assert.ok(narrowed.every((entry) => entry.confidence === "要確認" && entry.termKind === "社内用語"));
  assert.equal(filterAisGlossary(glossary.entries, { query: "存在しない用語" }).length, 0);
});
