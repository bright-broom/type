# ADR-006: Takken glossary ingestion and training

## Context
The app needs to preserve and expose all 446 supplied takken terms, including their readings, definitions, exam notes, laws, importance levels, and source IDs. The same source must support browsing and typing practice without a backend.

## Decision
Import the supplied tab-separated master glossary into a typed static JSON artifact. Derive typing prompts from that artifact at build time and keep filtering as a pure client-side operation over the same entries.

## Alternatives
Hand-maintained prompt objects, runtime TSV parsing, and a database-backed glossary were rejected because they duplicate data, add runtime failure modes, or exceed the local-first product boundary.

## Consequences
All glossary and training data remains on-device, one repeatable import command refreshes the dataset, and automated tests can enforce the exact 446-entry count. Updating the source requires rerunning the importer and committing the generated JSON.
