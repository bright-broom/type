import assert from "node:assert/strict";
import test from "node:test";
import { assertCurrentHead, autofixArtifactName, validateModifiedPatch } from "./autofix-contract.mjs";

const SHA = "a".repeat(40);

function entries(...values) {
  return Buffer.from(`${values.join("\0")}\0`);
}

test("artifact identity binds the pull request and exact SHA", () => {
  assert.equal(autofixArtifactName(32, SHA), `autofix-32-${SHA}`);
  assert.throws(() => autofixArtifactName("not-a-pr", SHA), /identity/);
  assert.throws(() => autofixArtifactName(32, "short"), /identity/);
});

test("a branch advance is rejected before writing or dispatching", () => {
  assert.doesNotThrow(() => assertCurrentHead(SHA, SHA, "open"));
  assert.throws(() => assertCurrentHead(SHA, "b".repeat(40), "open"), /advanced/);
  assert.throws(() => assertCurrentHead(SHA, SHA, "closed"), /closed/);
  assert.throws(() => assertCurrentHead(SHA, SHA), /unknown state/);
});

test("only modified files already owned by the pull request are accepted", () => {
  const unusual = "docs/name with space\tand\nline.md";
  assert.deepEqual(validateModifiedPatch(entries("M", unusual), [unusual]), [unusual]);
  assert.throws(() => validateModifiedPatch(entries("M", "outside.md"), ["inside.md"]), /outside/);
  for (const status of ["A", "D", "R100"]) {
    assert.throws(() => validateModifiedPatch(entries(status, "inside.md"), ["inside.md"]), /forbidden/);
  }
});

test("empty, truncated, or extra-token patch metadata is rejected", () => {
  assert.throws(() => validateModifiedPatch(Buffer.alloc(0), []), /invalid/);
  assert.throws(() => validateModifiedPatch(entries("M"), ["inside.md"]), /invalid/);
  assert.throws(() => validateModifiedPatch(entries("M", "inside.md", "extra"), ["inside.md"]), /invalid/);
});
