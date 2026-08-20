import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import test from "node:test";
import {
  canonicalDigest,
  isIsoDate,
  questionDigest,
  reviewAttestationPayload,
  validatePublishedQuestionReviews,
  validateSourceRegistry,
} from "../scripts/takken-governance-contract.mjs";

const edition = { examDate: "2026-10-18", legalBasisDate: "2026-04-01", verifiedAt: "2026-08-20" };
const document = {
  id: "law",
  url: "https://laws.e-gov.go.jp/api/2/law_data/id?asof=2026-04-01",
  asOfDate: "2026-04-01",
  digest: "a".repeat(64),
  format: "egov-json",
  expectedMarkers: ["法律"],
};

test("source registry requires complete mappings and allowlisted dated snapshots", () => {
  const registry = {
    retrievedAt: "2026-08-20",
    allowlistedHosts: ["laws.e-gov.go.jp", "www.mlit.go.jp", "www.retio.or.jp"],
    documents: [document],
    sourceMappings: [{ sourceId: "S01", documentIds: ["law"] }],
    watchDocumentIds: ["law"],
  };
  assert.deepEqual(validateSourceRegistry(registry, edition, ["S01"]), []);
  assert.match(
    validateSourceRegistry({ ...registry, sourceMappings: [] }, edition, ["S01"]).join("\n"),
    /source mappings differ/,
  );
  assert.match(
    validateSourceRegistry({ ...registry, documents: [{ ...document, url: "https://example.com/law" }] }, edition, [
      "S01",
    ]).join("\n"),
    /not allowlisted/,
  );
  assert.match(
    validateSourceRegistry({ ...registry, documents: [{ ...document, format: "binary" }] }, edition, ["S01"]).join(
      "\n",
    ),
    /unsupported source format/,
  );
});

test("a published question needs exact qualified per-revision evidence", () => {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const sourceRegistryDigest = canonicalDigest({ registry: 1 });
  const question = {
    id: "q1",
    revision: 2,
    stem: "stem",
    choices: [{ id: "a", text: "choice" }],
    correctChoiceId: "a",
    explanation: "explanation",
    legalBasisDate: "2026-04-01",
    sourceLabel: "source",
    categoryId: "rights",
    categoryLabel: "権利関係",
    conceptIds: ["concept-1"],
    sourceKind: "original-derived",
    reviewStatus: "published",
  };
  const unsignedEvidence = {
    questionId: "q1",
    revision: 2,
    status: "approved",
    reviewerId: "qualified-reviewer-01",
    qualification: "宅地建物取引士",
    reviewedAt: "2026-08-20",
    questionDigest: questionDigest(question),
    sourceRegistryDigest,
    qualificationEvidenceUrl: "https://example.invalid/owner-verified-credential",
    reviewEvidenceUrl: "https://github.com/bright-broom/type/commit/0123456789abcdef0123456789abcdef01234567",
  };
  const evidence = {
    ...unsignedEvidence,
    attestation: sign(null, Buffer.from(reviewAttestationPayload(unsignedEvidence)), privateKey).toString("base64"),
  };
  const trustedReviewers = {
    "qualified-reviewer-01": {
      qualification: "宅地建物取引士",
      qualificationEvidenceUrl: unsignedEvidence.qualificationEvidenceUrl,
      categoryIds: ["rights"],
      publicKeySpki: publicKey.export({ format: "der", type: "spki" }).toString("base64"),
    },
  };
  const validate = (reviewList, trust = trustedReviewers, verifiedAt = "2026-08-20") =>
    validatePublishedQuestionReviews([question], reviewList, sourceRegistryDigest, trust, verifiedAt);
  assert.match(validate([]).join("\n"), /missing/);
  assert.deepEqual(validate([evidence]), []);
  assert.match(validate([evidence, evidence]).join("\n"), /duplicate/);
  assert.match(validate([{ ...evidence, questionDigest: "b".repeat(64) }]).join("\n"), /stale|signature/);
  assert.match(validate([{ ...evidence, qualification: "automated" }]).join("\n"), /not allowed|signature/);
  assert.match(validate([evidence], {}).join("\n"), /owner-managed trust registry/);
  assert.match(validate([evidence], trustedReviewers, "2026-08-19").join("\n"), /later than/);
  assert.match(
    validate([evidence], {
      ...trustedReviewers,
      "qualified-reviewer-01": { ...trustedReviewers["qualified-reviewer-01"], categoryIds: ["tax-and-others"] },
    }).join("\n"),
    /not trusted for category/,
  );
  assert.match(
    validatePublishedQuestionReviews(
      [{ ...question, categoryId: "tax-and-others" }],
      [evidence],
      sourceRegistryDigest,
      trustedReviewers,
      "2026-08-20",
    ).join("\n"),
    /digest is stale|not trusted for category/,
  );
});

test("canonical digests do not depend on object key insertion order", () => {
  assert.equal(canonicalDigest({ b: 2, a: { d: 4, c: 3 } }), canonicalDigest({ a: { c: 3, d: 4 }, b: 2 }));
});

test("governance dates must exist on the UTC calendar", () => {
  assert.equal(isIsoDate("2026-08-20"), true);
  assert.equal(isIsoDate("2026-02-29"), false);
  assert.equal(isIsoDate("2026-99-99"), false);
});
