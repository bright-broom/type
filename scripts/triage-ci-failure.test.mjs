import assert from "node:assert/strict";
import test from "node:test";
import { triage } from "./triage-ci-failure.mjs";

test("a dependency conflict is blocking and quotes the offending pin", () => {
  const log = [
    "Quality gates\tInstall dependencies\t2026-08-18T09:12:14.6206871Z npm error code ERESOLVE",
    "Quality gates\tInstall dependencies\t2026-08-18T09:12:14.6213209Z npm error While resolving: @eslint/js@10.0.1",
    "Quality gates\tInstall dependencies\t2026-08-18T09:12:14.6214170Z npm error Found: eslint@9.39.5",
    'Quality gates\tInstall dependencies\t2026-08-18T09:12:14.6229260Z npm error peerOptional eslint@"^10.0.0" from @eslint/js@10.0.1',
  ].join("\n");
  const result = triage(log);
  assert.equal(result.blocking, true);
  assert.equal(result.fixable, false);
  assert.deepEqual(
    result.matched.map((rule) => rule.id),
    ["eresolve"],
  );
  assert.match(result.markdown, /マージ不可/);
  // The runner prefix, timestamp and npm label must not leak into the evidence.
  assert.match(result.markdown, /^While resolving: @eslint\/js@10\.0\.1$/m);
});

test("our own pin check is reported with the constraint that failed", () => {
  const log = [
    "Dependency compatibility\tCheck\tIncompatible dependency pins:",
    'Dependency compatibility\tCheck\t  typescript-eslint@8.67.0 requires typescript@">=4.8.4 <6.1.0" but typescript is pinned to 7.0.2',
  ].join("\n");
  const result = triage(log);
  assert.equal(result.blocking, true);
  assert.match(result.markdown, /typescript is pinned to 7\.0\.2/);
});

test("formatting and lint failures are reported as mechanically fixable", () => {
  const format = triage("[warn] src/app.ts\n[warn] Code style issues found in 1 file.");
  assert.equal(format.fixable, true);
  assert.equal(format.blocking, false);
  assert.match(format.markdown, /npm run format/);

  const lint = triage("/repo/src/a.ts\n  3:1  error  Unexpected var\n\n1 problem (1 error, 0 warnings)");
  assert.equal(lint.fixable, true);
  assert.match(lint.markdown, /eslint \. --fix/);
});

test("type errors, test failures and coverage gaps require a person", () => {
  for (const log of [
    "src/a.ts(3,5): error TS2345: Argument of type 'x'",
    "not ok 4 - session records the training set",
    "ERROR: Coverage for lines (39.1%) does not meet threshold (40%)",
  ]) {
    const result = triage(log);
    assert.equal(result.fixable, false, log);
    assert.ok(result.matched.length > 0, log);
  }
});

test("a secret or vulnerability finding blocks the merge", () => {
  assert.equal(triage("Potential secrets detected:\n- .env: tracked secret-bearing filename").blocking, true);
  assert.equal(triage("found 3 high severity vulnerabilities").blocking, true);
});

test("mixed failures are never treated as fully auto-fixable", () => {
  const result = triage("1 problem (1 error, 0 warnings)\nsrc/a.ts(1,1): error TS1005: ';' expected");
  assert.equal(result.fixable, false);
  assert.deepEqual(result.matched.map((rule) => rule.id).sort(), ["lint", "typecheck"]);
});

test("an unrecognised failure says so instead of guessing", () => {
  const result = triage("Error: connect ETIMEDOUT 140.82.121.4:443");
  assert.deepEqual(result.matched, []);
  assert.equal(result.blocking, false);
  assert.match(result.markdown, /既知のパターンに一致しませんでした/);
});
