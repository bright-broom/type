import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { validatePrompts } from "../../domain/prompts/validate-prompts.ts";
import { GIT_COMMAND_CATALOGUE, GIT_COMMAND_PROMPTS } from "./git-commands.ts";

const EXPECTED_COMMAND_COUNT = 161;
const EXPECTED_SOURCE_VERSION = "2.55.0";
const EXPECTED_SOURCE_FILE_SHA256 = "74f660860cfc4b6e4939f8fd64749dd495a43bf0a8be464298a896111313ad66";
const EXPECTED_CATEGORY_COUNTS = {
  mainporcelain: 46,
  ancillarymanipulators: 12,
  ancillaryinterrogators: 17,
  foreignscminterface: 10,
  plumbingmanipulators: 20,
  plumbinginterrogators: 25,
  synchingrepositories: 5,
  synchelpers: 6,
  purehelpers: 19,
  alias: 1,
};

test("imports every executable command classified by Git 2.55.0", async () => {
  const source = await readFile(new URL("./git-command-list-v2.55.0.txt", import.meta.url), "utf8");
  assert.equal(GIT_COMMAND_CATALOGUE.source.version, EXPECTED_SOURCE_VERSION);
  assert.equal(GIT_COMMAND_CATALOGUE.source.fileSha256, EXPECTED_SOURCE_FILE_SHA256);
  assert.equal(createHash("sha256").update(source).digest("hex"), EXPECTED_SOURCE_FILE_SHA256);
  assert.equal(GIT_COMMAND_CATALOGUE.stats.commandCount, EXPECTED_COMMAND_COUNT);
  assert.equal(GIT_COMMAND_CATALOGUE.entries.length, EXPECTED_COMMAND_COUNT);
  assert.deepEqual(GIT_COMMAND_CATALOGUE.stats.categoryCounts, EXPECTED_CATEGORY_COUNTS);
  assert.match(GIT_COMMAND_CATALOGUE.source.scope, /git-stage classified as an alias/);
});

test("exposes every Git command as a unique directly typable prompt", () => {
  assert.equal(GIT_COMMAND_PROMPTS.length, EXPECTED_COMMAND_COUNT);
  assert.deepEqual(validatePrompts(GIT_COMMAND_PROMPTS), []);
  assert.equal(new Set(GIT_COMMAND_PROMPTS.map((prompt) => prompt.id)).size, EXPECTED_COMMAND_COUNT);
  assert.ok(GIT_COMMAND_PROMPTS.some((prompt) => prompt.displayText === "git add"));
  assert.ok(GIT_COMMAND_PROMPTS.some((prompt) => prompt.displayText === "git url-parse"));
  assert.ok(GIT_COMMAND_PROMPTS.some((prompt) => prompt.displayText === "gitk"));
  assert.ok(GIT_COMMAND_PROMPTS.some((prompt) => prompt.displayText === "gitweb"));
  assert.ok(GIT_COMMAND_PROMPTS.some((prompt) => prompt.displayText === "scalar"));
  assert.ok(GIT_COMMAND_PROMPTS.every((prompt) => prompt.reading === prompt.displayText));
});
