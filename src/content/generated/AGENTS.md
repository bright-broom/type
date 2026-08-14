# Generated content rules

- Never edit JSON files in this directory by hand.
- Regenerate `consulting-playbook.json` and `consulting-prompts.json` with `npm run import:consulting -- "/path/to/source.xlsx"`.
- Regenerate `takken-glossary.json` with `npm run import:takken -- "/path/to/source.tsv"`.
- Commit importer changes, generated outputs, and dataset-test updates together.
- Review generated diffs for counts and schema changes; do not review them as authored source code.
