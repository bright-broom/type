# ADR-009: AIS meeting glossary ingestion with de-identification at import time

## Context

The AIS weekly meeting glossary workbook is a normalised database of 154 terms
(term master, atomic categories, a term-category join, per-meeting context, and a
review queue). Unlike the takken and consulting sources it is **confidential
meeting material**: it names customers and individuals and quotes pipeline
amounts, deal counts, and probability deltas.

TypeLoop ships as a static bundle. Anything reaching `src/content/generated` is
served to every visitor of a deployed build, so the vocabulary is publishable but
the identities and figures around it are not.

## Decision

De-identify at import time and treat the generated artifact as the only form that
exists inside the repository.

- Masking is driven by the workbook's own `種別` column (`顧客名`, `人名`, and
  proper nouns filed under a customer category) rather than a hard-coded list of
  names, so no confidential name is written into this repository.
- Each masked party receives a stable pseudonym (`顧客A`, `担当者A`) assigned in
  `term_id` order, and every alias of that party is substituted across all text.
- Quoted amounts, deal counts, and ratios are replaced with non-disclosure
  markers by explicit regex rules.
- The importer fails if any alias or figure survives, and the entry count,
  pseudonym shape, and figure-freedom are re-asserted by unit tests so a
  hand-edited artifact cannot ship.
- The monetary fact sheets (`06_主要数値`, `07_数値-用語リンク`,
  `11_主要数値_VIEW`) are not imported at all: they are pipeline financials, not
  vocabulary.

Readings are authored separately in `scripts/ais_glossary_readings.py` because the
source has no reading column. They are keyed by the displayed term so a renamed
or removed term fails the import instead of silently losing its reading.

## Alternatives

- **Ship the workbook verbatim.** Rejected: it publishes customer names, personal
  data, and pipeline figures to a public URL.
- **Gate the dataset behind a build-time flag.** Rejected: the data would still be
  in the repository and one misconfigured build would leak it. Masking removes the
  risk instead of managing it.
- **Mask in the presentation layer.** Rejected: the confidential values would
  still be in the shipped bundle and reachable from the browser.
- **Hard-code the names to mask.** Rejected: the deny list itself would be the
  leak.

## Consequences

The glossary is safe to browse and practise in any deployment, and the masking is
auditable: the artifact records the policy, the number of masked parties, and the
redaction counts per rule. Nine parties are represented by pseudonyms, so their
real names can only be recovered from the source workbook, which stays outside
version control. Refreshing the dataset means rerunning `npm run import:ais` and
committing the regenerated JSON.

Supporting the loanword syllables these terms need (`じぇ`, `ちぇ`, `つぁ`, `ふゅ`,
`うぃ`, and neighbours) extends the variant table described in ADR-005 without
changing its matching rules.
