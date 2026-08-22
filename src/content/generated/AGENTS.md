# Generated content rules

- Never edit JSON files in this directory by hand.
- Regenerate `consulting-playbook.json` and `consulting-prompts.json` with `npm run import:consulting -- "/path/to/source.xlsx"`.
- Regenerate `takken-glossary.json` from its tracked normalized TSV with `npm run import:takken`; use `npm run check:generated` for byte-for-byte verification.
- Never promote Takken questions to `published` without per-revision qualified review evidence; source drift creates an Issue and never edits generated content.
- Regenerate `git-commands.json` from the byte-for-byte Git 2.55.0 source snapshot with `npm run import:git`; verify it without writing with `npm run check:generated`.
- Restricted business or personal data is not an eligible generated artifact. Pseudonymization is not sufficient for publication; see [ADR-024](../../../docs/adr/ADR-024-public-release-privacy-boundary.md).
- Commit importer changes, generated outputs, and dataset-test updates together.
- Review generated diffs for counts and schema changes; do not review them as authored source code.
