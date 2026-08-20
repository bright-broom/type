#!/usr/bin/env node

import glossary from "../src/content/generated/takken-glossary.json" with { type: "json" };
import edition from "../src/content/takken/takken-edition.json" with { type: "json" };
import reviews from "../src/content/takken/takken-question-reviews.json" with { type: "json" };
import registry from "../src/content/takken/takken-source-registry.json" with { type: "json" };
import { TAKKEN_ASSESSMENT_QUESTIONS } from "../src/content/takken/takken-assessment-pack.ts";
import {
  canonicalDigest,
  validatePublishedQuestionReviews,
  validateSourceRegistry,
} from "./takken-governance-contract.mjs";

const registryDigest = canonicalDigest(registry);
let trustedReviewers = {};
try {
  trustedReviewers = JSON.parse(process.env.TAKKEN_REVIEWER_KEYS_JSON || "{}");
} catch {
  console.error("- TAKKEN_REVIEWER_KEYS_JSON must be valid JSON");
  process.exit(1);
}
const errors = [
  ...validateSourceRegistry(registry, edition, glossary.filters.sourceIds),
  ...validatePublishedQuestionReviews(
    TAKKEN_ASSESSMENT_QUESTIONS,
    reviews.reviews,
    registryDigest,
    trustedReviewers,
    edition.verifiedAt,
  ),
];

if (glossary.edition !== edition.label) errors.push("generated glossary edition is stale");
if (glossary.examDate !== edition.examDate) errors.push("generated glossary exam date is stale");
if (glossary.legalBasisDate !== edition.legalBasisDate) errors.push("generated glossary legal-basis date is stale");
if (glossary.provenance?.sourceRegistryDigest !== registryDigest) {
  errors.push("generated glossary source registry digest is stale");
}

if (errors.length > 0) {
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(
  `Verified ${glossary.entries.length} glossary entries, ${registry.documents.length} official sources, and ${TAKKEN_ASSESSMENT_QUESTIONS.length} governed questions.`,
);
