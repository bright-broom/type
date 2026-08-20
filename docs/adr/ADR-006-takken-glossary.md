# ADR-006: Takken glossary ingestion and training

## Context

The app needs to preserve and expose all 446 supplied takken terms, including their readings, definitions, exam notes, laws, importance levels, and source IDs. The same source must support browsing and typing practice without a backend.

## Decision

Keep the normalized tab-separated master glossary in `src/content/takken/source/` and import it into a typed static JSON artifact. Edition, exam date, and legal-basis date come from an authored edition manifest rather than importer literals. Every source ID must resolve through an authored registry to allowlisted RETIO, Ministry of Land, Infrastructure, Transport and Tourism, or e-Gov HTTPS material with retrieval and as-of dates plus a SHA-256 digest. The generated artifact embeds both the source snapshot digest and canonical registry digest. CI regenerates the artifact byte-for-byte, so a direct edit or stale provenance fails the quality gate.

Derive typing prompts from that artifact at build time and keep filtering as a pure client-side operation over the same entries. A scheduled monitor compares high-risk official documents and reconciles one GitHub Issue when they drift. It never changes or publishes learning content.

## Alternatives

Hand-maintained prompt objects, runtime TSV parsing, and a database-backed glossary were rejected because they duplicate data, add runtime failure modes, or exceed the local-first product boundary.

## Consequences

All glossary and training data remains on-device, `npm run import:takken` reproduces the dataset from the tracked master, and automated tests enforce the exact 446-entry count and provenance contract. Updating a source snapshot or registry digest is an explicit reviewed repository change; detection is automated but legal interpretation is not.
