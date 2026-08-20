import { createHash, createPublicKey, verify } from "node:crypto";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const SHA256 = /^[a-f0-9]{64}$/;
const REVIEWER_ID = /^[a-z0-9][a-z0-9._-]{2,63}$/;
const OFFICIAL_HOSTS = new Set(["laws.e-gov.go.jp", "www.mlit.go.jp", "www.retio.or.jp"]);

export const QUALIFIED_REVIEWER_ROLES = new Set(["宅地建物取引士", "弁護士", "司法書士", "税理士"]);

export function isIsoDate(value) {
  if (typeof value !== "string" || !ISO_DATE.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}

export function stableSerialize(value) {
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${stableSerialize(entry)}`);
    return `{${entries.join(",")}}`;
  }
  return JSON.stringify(value);
}

export function canonicalDigest(value) {
  return createHash("sha256").update(stableSerialize(value)).digest("hex");
}

export function validateSourceRegistry(registry, edition, glossarySourceIds) {
  const errors = [];
  const configuredHosts = [...new Set(registry.allowlistedHosts ?? [])].sort();
  const officialHosts = [...OFFICIAL_HOSTS].sort();
  if (JSON.stringify(configuredHosts) !== JSON.stringify(officialHosts)) {
    errors.push(`official host allowlist must be exactly: ${officialHosts.join(", ")}`);
  }
  if (!isIsoDate(registry.retrievedAt)) errors.push("registry retrieval date must be a real YYYY-MM-DD date");
  const documents = new Map();
  for (const document of registry.documents ?? []) {
    if (!document?.id || documents.has(document.id)) errors.push(`duplicate or missing document id: ${document?.id}`);
    documents.set(document?.id, document);
    let url;
    try {
      url = new URL(document.url);
    } catch {
      errors.push(`${document?.id}: invalid URL`);
      continue;
    }
    if (url.protocol !== "https:" || !OFFICIAL_HOSTS.has(url.hostname)) {
      errors.push(`${document.id}: source host is not allowlisted`);
    }
    if (!isIsoDate(document.asOfDate)) errors.push(`${document.id}: invalid as-of date`);
    if (isIsoDate(document.asOfDate) && document.asOfDate > edition.verifiedAt) {
      errors.push(`${document.id}: as-of date is later than the verified edition date`);
    }
    if (!SHA256.test(document.digest ?? "")) errors.push(`${document.id}: invalid digest`);
    if (!new Set(["egov-json", "html-text"]).has(document.format)) {
      errors.push(`${document.id}: unsupported source format`);
    }
    if (!Array.isArray(document.expectedMarkers) || document.expectedMarkers.length === 0) {
      errors.push(`${document.id}: expected markers are required`);
    }
    if (document.contentWindow && (!document.contentWindow.startMarker || !document.contentWindow.endMarker)) {
      errors.push(`${document.id}: content window requires start and end markers`);
    }
    if (
      document.format === "egov-json" &&
      (url.searchParams.get("asof") !== edition.legalBasisDate || document.asOfDate !== edition.legalBasisDate)
    ) {
      errors.push(`${document.id}: e-Gov snapshot must use the exam legal-basis date`);
    }
  }

  const mappings = new Map();
  for (const mapping of registry.sourceMappings ?? []) {
    if (!mapping?.sourceId || mappings.has(mapping.sourceId)) {
      errors.push(`duplicate or missing source mapping: ${mapping?.sourceId}`);
    }
    mappings.set(mapping?.sourceId, mapping);
    if (!Array.isArray(mapping?.documentIds) || mapping.documentIds.length === 0) {
      errors.push(`${mapping?.sourceId}: at least one official document is required`);
    }
    for (const documentId of mapping?.documentIds ?? []) {
      if (!documents.has(documentId)) errors.push(`${mapping.sourceId}: unknown document ${documentId}`);
    }
  }
  const expected = [...new Set(glossarySourceIds)].sort();
  const actual = [...mappings.keys()].filter(Boolean).sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    errors.push(`source mappings differ: expected ${expected.join(", ")}; received ${actual.join(", ")}`);
  }
  for (const documentId of registry.watchDocumentIds ?? []) {
    if (!documents.has(documentId)) errors.push(`unknown watch document: ${documentId}`);
  }
  if (!isIsoDate(edition.examDate) || !isIsoDate(edition.legalBasisDate)) {
    errors.push("edition dates must be real YYYY-MM-DD dates");
  }
  if (!isIsoDate(edition.verifiedAt)) errors.push("edition verification date must be a real YYYY-MM-DD date");
  if (edition.legalBasisDate >= edition.examDate) errors.push("legal basis date must precede the exam date");
  return errors;
}

export function questionDigest(question) {
  return canonicalDigest({
    id: question.id,
    revision: question.revision,
    stem: question.stem,
    choices: question.choices,
    correctChoiceId: question.correctChoiceId,
    explanation: question.explanation,
    categoryId: question.categoryId,
    categoryLabel: question.categoryLabel,
    conceptIds: question.conceptIds,
    legalBasisDate: question.legalBasisDate,
    sourceKind: question.sourceKind,
    sourceLabel: question.sourceLabel,
  });
}

export function reviewAttestationPayload(review) {
  return stableSerialize({
    questionId: review.questionId,
    revision: review.revision,
    status: review.status,
    reviewerId: review.reviewerId,
    qualification: review.qualification,
    reviewedAt: review.reviewedAt,
    questionDigest: review.questionDigest,
    sourceRegistryDigest: review.sourceRegistryDigest,
    qualificationEvidenceUrl: review.qualificationEvidenceUrl,
    reviewEvidenceUrl: review.reviewEvidenceUrl,
  });
}

function isImmutableRepositoryEvidence(rawUrl) {
  try {
    const url = new URL(rawUrl);
    return (
      url.protocol === "https:" &&
      url.hostname === "github.com" &&
      url.username === "" &&
      url.password === "" &&
      url.port === "" &&
      url.search === "" &&
      url.hash === "" &&
      /^\/bright-broom\/type\/commit\/[a-f0-9]{40}$/.test(url.pathname)
    );
  } catch {
    return false;
  }
}

function verifyReviewAttestation(review, trustedReviewer) {
  try {
    const publicKey = createPublicKey({
      key: Buffer.from(trustedReviewer.publicKeySpki, "base64"),
      format: "der",
      type: "spki",
    });
    return verify(
      null,
      Buffer.from(reviewAttestationPayload(review)),
      publicKey,
      Buffer.from(review.attestation ?? "", "base64"),
    );
  } catch {
    return false;
  }
}

export function validatePublishedQuestionReviews(
  questions,
  reviews,
  sourceRegistryDigest,
  trustedReviewers = {},
  verifiedAt,
) {
  const errors = [];
  const evidence = new Map();
  for (const review of reviews ?? []) {
    const key = `${review.questionId}@${review.revision}`;
    if (evidence.has(key)) errors.push(`${key}: duplicate review evidence`);
    evidence.set(key, review);
  }
  for (const question of questions) {
    if (question.reviewStatus !== "published") continue;
    const key = `${question.id}@${question.revision}`;
    const review = evidence.get(key);
    if (!review) {
      errors.push(`${key}: qualified review evidence is missing`);
      continue;
    }
    if (review.status !== "approved") errors.push(`${key}: review is not approved`);
    if (!REVIEWER_ID.test(review.reviewerId ?? "")) errors.push(`${key}: reviewer id is invalid`);
    if (!QUALIFIED_REVIEWER_ROLES.has(review.qualification)) errors.push(`${key}: qualification is not allowed`);
    if (!isIsoDate(review.reviewedAt)) errors.push(`${key}: reviewedAt is invalid`);
    if (isIsoDate(review.reviewedAt) && (!isIsoDate(verifiedAt) || review.reviewedAt > verifiedAt)) {
      errors.push(`${key}: reviewedAt is later than the verified edition date`);
    }
    if (review.questionDigest !== questionDigest(question)) errors.push(`${key}: reviewed question digest is stale`);
    if (review.sourceRegistryDigest !== sourceRegistryDigest) errors.push(`${key}: source registry digest is stale`);
    if (!isImmutableRepositoryEvidence(review.reviewEvidenceUrl)) {
      errors.push(`${key}: reviewEvidenceUrl must identify an immutable TypeLoop review`);
    }

    const trustedReviewer = trustedReviewers[review.reviewerId];
    if (!trustedReviewer) {
      errors.push(`${key}: reviewer is not present in the owner-managed trust registry`);
      continue;
    }
    if (trustedReviewer.qualification !== review.qualification) {
      errors.push(`${key}: qualification does not match the trust registry`);
    }
    if (trustedReviewer.qualificationEvidenceUrl !== review.qualificationEvidenceUrl) {
      errors.push(`${key}: qualification evidence does not match the trust registry`);
    }
    if (
      !Array.isArray(trustedReviewer.categoryIds) ||
      (!trustedReviewer.categoryIds.includes("*") && !trustedReviewer.categoryIds.includes(question.categoryId))
    ) {
      errors.push(`${key}: reviewer is not trusted for category ${question.categoryId}`);
    }
    if (!verifyReviewAttestation(review, trustedReviewer)) {
      errors.push(`${key}: review attestation signature is invalid`);
    }
  }
  return errors;
}
