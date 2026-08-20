# Directory structure

## Canonical tree

```text
.
├── .agents/skills/             Repo-scoped agent workflows
├── AGENTS.md
├── app/                         Next.js routes, metadata, global CSS
│   └── styles/                  Theme registry and global presentation styles
├── docs/
│   ├── architecture.md         Runtime and dependency design
│   ├── design-system.md        Visual language and token responsibilities
│   ├── directory-structure.md  Placement and naming rules
│   └── adr/                    Durable design decisions
├── scripts/                    Repeatable import and maintenance scripts
├── src/
│   ├── application/
│   │   ├── ports/              Interfaces required by the application
│   │   ├── assessment/         Assessment lifecycle and persisted attempt types
│   │   ├── settings/           Persisted application preferences and validation
│   │   └── session/            Session state and transitions
│   ├── content/
│   │   ├── training-set-catalog.ts  Binds each TrainingSet id to its dataset
│   │   ├── generated/          Versioned JSON with scoped agent guidance
│   │   ├── ais/                One directory per dataset: types, filters,
│   │   ├── consulting/         prompt adapter, and dataset tests
│   │   ├── git/                Versioned official Git command source and prompts
│   │   ├── japanese/
│   │   └── takken/
│   ├── domain/                 Pure business rules by capability, including typing and assessment
│   ├── infrastructure/         Browser adapters by capability
│   └── presentation/
│       ├── components/         React components by screen/capability
│       │   └── layout/         Cross-screen page geometry contracts
│       ├── hooks/              Browser-facing orchestration hooks
│       └── theme/              Document theme application and bootstrap
└── tests/                      Cross-layer and repository policy tests
```

## Placement rules

- Framework entry points stay in `app`; product behavior does not.
- Pure rules and value calculations belong in `domain`.
- Session orchestration and capability interfaces belong in `application`.
- Browser or vendor-specific implementations belong in `infrastructure`.
- React rendering and browser event composition belong in `presentation`.
- Cross-screen page geometry belongs in `presentation/components/layout`; screens choose a typed `PageShell` role and retain ownership of their internal Grid/Flex composition.
- Theme identifiers, defaults, and cookie encoding belong in `application/settings`; DOM application belongs in `presentation/theme`; raw visual values belong in `app/styles/themes.css`; the current product treatment belongs in the scoped `app/styles/modern.css` layer.
- Learning material and prompt adapters belong in `content`, one directory per dataset. A dataset directory owns its types, filters, prompt adapter, and tests, and must not import another dataset.
- `content/training-set-catalog.ts` is the only module that reaches across datasets. It is the seam where a `TrainingSet` identifier is bound to its prompts.
- Pure rules over domain types belong in `domain` even when only `content` calls them, as with `domain/prompts/validate-prompts.ts`.
- Cross-layer rules belong in root `tests`; capability tests stay beside their source.

Do not create a generic `shared`, `common`, `utils`, or `helpers` bucket. A module used by several callers still belongs to the layer and capability that owns its responsibility. Rename around purpose before extracting around reuse.

## Naming rules

- React component files: `PascalCase.tsx`.
- Components that own a complete application work surface end in `Screen`, `App`, `Glossary`, `Playbook`, or `Launcher`; route wrappers end in `Route`. This lets repository policy discover every `PageShell` owner independently from its imports.
- Other files under `src`, `app`, and `tests`: `kebab-case.ts`, `kebab-case.tsx`, or `kebab-case.mjs`.
- Files under `scripts`: `snake_case`, named after the command that runs them, such as `import_ais_glossary.py` for `npm run import:ais`. Supporting policy or data modules keep the importer's prefix.
- Tests: `<subject>.test.<extension>` beside the subject when layer-local.
- Ports: responsibility names such as `session-repository.ts`; implementations add their mechanism, such as `local-session-repository.ts`.
- ADRs: `ADR-NNN-short-decision.md` with the next sequential number.

## Generated content

Everything under `src/content/generated` is importer output. Do not edit it manually. Regenerate it with the commands documented in `AGENTS.md` and commit the importer change together with its generated output.

Generated files may be large. Authored TypeScript, JavaScript, and Python files must remain below 300 lines; the repository convention test enforces this ceiling. Size is a review signal, not permission for arbitrary splitting: extract only when a separate responsibility or stable interface exists.

## Adding new files

Before creating a directory, identify its owner, layer, and dependency direction. Prefer an existing capability directory when the responsibility matches. A new top-level source layer or a dependency-direction change requires an ADR and an update to the architecture boundary test.

Keep repository-wide invariants in the root `AGENTS.md`. Put repeatable, task-specific procedures in `.agents/skills` so agents load them only when relevant. Add a nested `AGENTS.md` only when a directory has a consequential local rule that should not consume context for unrelated work.
