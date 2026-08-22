# ADR-024: Public-release privacy and restricted-content boundary

## Status

Accepted — 2026-08-22

## Context

TypeLoop is a static, local-first application intended for unrestricted public use. A
meeting glossary had removed direct names and figures but retained stable pseudonyms,
meeting identifiers, dates, workflow context, and deal timing. Those fields can still be
linked to outside knowledge; pseudonymization is not anonymization. Completed typing
sessions also retained prompt text and ordered keystrokes even though product history uses
only scores and weak-key aggregates.

Repository visibility is a separate boundary. Git history can retain deleted data and
author email metadata after the current tree is safe, so making the Git repository public
cannot be inferred from a safe production bundle.

## Decision

- Restricted business material, personal data, and re-identifiable pseudonyms never enter
  runtime source, generated public content, or browser assets. The meeting glossary route,
  importer, training mode, and generated artifact are removed rather than masked further.
- `check:privacy` scans the current public delivery tree without printing matched values.
  The static-build gate scans emitted route and client artifacts for the same restricted
  markers. Both fail closed on a known disclosure signature.
- Completed session persistence and archive export retain only product-required aggregates.
  Prompt text and ordered keystrokes are stripped on new writes and legacy migration.
- The exact service-worker caches known to contain the retired dataset trigger a one-release
  immediate activation, purge, client claim, and worker-owned navigation after the replacement
  shell stages successfully. Unknown old static chunks cannot enter the new cache. Other
  upgrades retain the atomic waiting policy in ADR-021.
- The product publishes a plain-language privacy screen. A public policy and private
  vulnerability-reporting path must be verified independently of repository access before
  general distribution; an unreachable private-repository link must never be presented as
  a reporting channel. No telemetry, account, backend, or third-party runtime call is introduced.
- Application publication and repository publication use separate release gates. Before a
  repository visibility change, an owner must assess or remove sensitive historical blobs
  and personal author metadata, enable native GitHub scanning and protection, and record the
  evidence. History rewriting is destructive and requires explicit human authorization.

## Alternatives

- **Keep the pseudonymized glossary.** Rejected because context and stable identifiers can
  still support re-identification and disclose confidential business operations.
- **Hide the route but keep the artifact.** Rejected because static chunks and repository
  history remain accessible independently of visible navigation.
- **Encrypt browser history.** Rejected because there is no account or key-management
  boundary; minimization removes the unnecessary data instead of creating security theatre.
- **Automatically rewrite Git history.** Rejected because it changes every historical
  commit and collaborator clone and requires an owner-controlled migration.

## Consequences

The public product loses one internal training dataset and retains Japanese, consulting,
Git, and takken learning surfaces. Existing local typing histories, including records from
the retired dataset, migrate to aggregate-only records on their next read. A clean current
tree is necessary but not sufficient to make the GitHub repository public; both product
distribution and repository visibility remain explicit owner gates.
