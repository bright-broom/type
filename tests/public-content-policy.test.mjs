import assert from "node:assert/strict";
import test from "node:test";
import {
  isPublicRuntimePath,
  publicContentViolations,
  restrictedTextViolations,
} from "../scripts/public-content-policy.mjs";

test("public runtime paths exclude tests and repository instructions", () => {
  assert.equal(isPublicRuntimePath("src/content/catalog.ts"), true);
  assert.equal(isPublicRuntimePath("public/application-routes.json"), true);
  assert.equal(isPublicRuntimePath("src/content/catalog.test.ts"), false);
  assert.equal(isPublicRuntimePath("src/content/generated/AGENTS.md"), false);
  assert.equal(isPublicRuntimePath("docs/adr/ADR-009.md"), false);
});

test("restricted meeting material fails closed without returning its value", () => {
  assert.deepEqual(publicContentViolations("src/content/generated/ais-glossary.json", "safe"), [
    "restricted-runtime-path",
  ]);
  assert.deepEqual(restrictedTextViolations("record MTG-20260817-AIS for 顧客A"), [
    "meeting-record-id",
    "stable-party-pseudonym",
  ]);
});

test("personal emails are rejected from shipped source while examples remain usable in tests", () => {
  assert.deepEqual(publicContentViolations("app/contact/page.tsx", "mailto:person@company.jp"), ["personal-email"]);
  assert.deepEqual(publicContentViolations("app/contact/page.tsx", "mailto:user@example.com"), []);
  assert.deepEqual(publicContentViolations("app/contact/page.tsx", "mailto:user@example.com.jp"), ["personal-email"]);
  assert.deepEqual(publicContentViolations("app/contact/page.tsx", "mailto:user@example.com.evil"), ["personal-email"]);
  assert.deepEqual(publicContentViolations("app/contact/page.test.ts", "person@company.jp"), []);
});
