import assert from "node:assert/strict";
import test from "node:test";
import { analyzeWeakKeys } from "./weak-key-analyzer.ts";

test("ignores statistically weak single samples", () => {
  const result = analyzeWeakKeys([
    { key: "z", correct: false },
    ...Array.from({ length: 5 }, () => ({ key: "a", correct: true })),
    { key: "a", correct: false },
  ]);
  assert.equal(
    result.some((entry) => entry.key === "z"),
    false,
  );
  assert.equal(result[0]?.key, "a");
});
