# Generated content rules

- Never edit JSON files in this directory by hand.
- Regenerate `consulting-playbook.json` and `consulting-prompts.json` with `npm run import:consulting -- "/path/to/source.xlsx"`.
- Regenerate `takken-glossary.json` with `npm run import:takken -- "/path/to/source.tsv"`.
- Regenerate `ais-glossary.json` with `npm run import:ais -- "/path/to/source.xlsx"`.
- Regenerate `git-commands.json` from the byte-for-byte Git 2.55.0 source snapshot with `npm run import:git`.
- Regenerate `tokyo-place-names.json` from the pinned Tokyo place CSV and reviewed reading overrides with `npm run import:tokyo`.
- Verify every generated catalogue without writing with `npm run check:generated`.
- `ais-glossary.json` is the de-identified form of confidential meeting minutes: customer and personal names are replaced and quoted figures are redacted at import time. Never commit the source workbook and never hand-edit this artifact. See [ADR-009](../../../docs/adr/ADR-009-ais-meeting-glossary.md).
- Commit importer changes, generated outputs, and dataset-test updates together.
- Review generated diffs for counts and schema changes; do not review them as authored source code.
