# ADR-022: Human-owned agent control plane

## Context

TypeLoop already requires feature branches, pull requests, deterministic CI, and human merges. Written instructions alone
do not stop a local agent from issuing a dangerous command, while an unconstrained AI workflow would turn untrusted pull
request output into a write-capable supply-chain boundary. The repository also lacked durable trend evidence for whether
the automation improves lead time or merely moves failures later.

This ADR follows ADR-019 through ADR-021 and is carried only in branch ancestry that already contains those prerequisite decisions.

## Decision

- Commit a repository Codex `PreToolUse` hook that denies direct protected-branch pushes, PR merge commands, protected-ref
  API mutation, and every Vercel CLI command while its dependency audit is blocked. The hook fails closed on malformed Bash
  input.
- Keep server-side rules and required CI authoritative. A hook runs only in trusted Codex clients after an owner reviews
  it, and is a guardrail rather than a security boundary.
- Add an opt-in Codex CI advisory after deterministic failure classification. It checks out only the default branch,
  receives untrusted logs as data, has read-only GitHub/filesystem permissions, cannot comment or push, and stores its
  output as a short-lived artifact for a human. It remains disabled until an owner configures the repository variable
  `CODEX_CI_ADVISORY_ENABLED=true` and the `OPENAI_API_KEY` Actions secret.
- Apply ADR-020's documented exception mechanism by allowing only `openai/codex-action@*` while retaining the repository-wide
  full-SHA requirement. This owner-managed exception must be recorded in the agent control checklist before
  the advisory switch is enabled; verified Marketplace actions and broader patterns remain disabled.
- Continue to reserve mechanical formatter/linter changes for the existing constrained autofix workflow. Codex does not
  generate or apply patches, merge PRs, or deploy production.
- Generate a read-only weekly 28-day report for initial CI success, time to green, review revisions, post-merge failures,
  pre-production failure detection, and completion of `codex/*` pull requests. These are process signals, never developer
  performance scores.
- Do not expose a repository Vercel CLI runner yet. The evaluated exact release (`59.1.4`) introduces High/Critical audit
  findings and `npm exec` would re-resolve its transitive graph outside the root audit. Repository hooks therefore deny every
  Vercel CLI command. The existing GitHub/Vercel preview integration remains the deployment path; production remains a
  human decision. A future clean release may add an isolated lockfile or digest-pinned image plus its own audit gate.

## Alternatives

- **Rely only on `AGENTS.md`:** portable but unable to stop an accidental command.
- **Let Codex push patches or comments automatically:** rejected because logs and PR metadata are prompt-injection input,
  and the benefit does not justify a write token or noisy automated opinion.
- **Use a hosted analytics product:** rejected while the repository can derive the needed aggregate signals from the
  GitHub API without introducing runtime telemetry or another data processor.

## Consequences

Owners must review and trust repository hooks in each Codex client. External contributors and other tools remain governed
by GitHub rules rather than the local hook. Enabling the advisory sends the selected CI context to the configured OpenAI
API account; the default disabled state makes that data boundary explicit. Metrics may be `n/a` in quiet windows and must
not be interpreted as zero. PRs for this ADR must not be merged before ADR-019 through ADR-021 are present on `main`.
The Vercel CLI deferral is a security blocker, not an invitation to use a mutable global installation.
