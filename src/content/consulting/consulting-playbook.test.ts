import assert from "node:assert/strict";
import test from "node:test";
import playbook from "../generated/consulting-playbook.json" with { type: "json" };
import { CONSULTING_PROMPTS } from "../prompts/consulting-prompts.ts";
import { validatePrompts } from "../prompts/validate-prompts.ts";

test("imports every workbook section, populated cell, and formula value", () => {
  assert.equal(playbook.stats.sheetCount, 17);
  assert.equal(playbook.sheets.length, 17);
  assert.equal(playbook.stats.nonemptyCellCount, 10_132);
  assert.equal(playbook.stats.formulaCellCount, 84);
  assert.ok(playbook.stats.rowCount >= 1_000);
  const countedCells = playbook.sheets.reduce(
    (sheetTotal, sheet) => sheetTotal + sheet.rows.reduce((rowTotal, row) => rowTotal + row.cells.length, 0),
    0,
  );
  const countedFormulas = playbook.sheets.reduce(
    (sheetTotal, sheet) => sheetTotal + sheet.rows.reduce(
      (rowTotal, row) => rowTotal + row.cells.filter((cell) => "formula" in cell).length,
      0,
    ),
    0,
  );
  assert.equal(countedCells, playbook.stats.nonemptyCellCount);
  assert.equal(countedFormulas, playbook.stats.formulaCellCount);
});

test("consulting dictionary generates a large validated typing set", () => {
  assert.ok(CONSULTING_PROMPTS.length >= 300);
  assert.deepEqual(validatePrompts(CONSULTING_PROMPTS), []);
  assert.equal(new Set(CONSULTING_PROMPTS.map((prompt) => prompt.reading)).size, CONSULTING_PROMPTS.length);
});
