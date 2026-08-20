# Agent control checklist

Repository source can define safe defaults, but it cannot prove owner-managed GitHub/Codex settings remain active. Verify
this checklist after Actions policy, credential, ownership, visibility, or plan changes and before enabling the advisory.

| Control                  | Required state before enablement                                           | Current repository state (2026-08-21 JST) |
| ------------------------ | -------------------------------------------------------------------------- | ----------------------------------------- |
| Codex advisory switch    | `CODEX_CI_ADVISORY_ENABLED` absent or `false` until every row is satisfied | Disabled; variable not enabled            |
| API credential           | `OPENAI_API_KEY` Actions secret owned and rotated by the repository owner  | Absent; advisory remains disabled         |
| Action source            | `openai/codex-action` at the ADR-pinned full commit SHA                    | Pinned in workflow source                 |
| Allowed Actions          | GitHub-owned actions plus only `openai/codex-action@*`                     | Enforced by GitHub setting                |
| SHA pinning              | Full commit SHA required                                                   | Enforced by GitHub setting                |
| Workflow token           | `actions: read`, `contents: read`; no write permission                     | Enforced in workflow and policy tests     |
| Codex permission profile | `:read-only` with `drop-sudo`                                              | Enforced in workflow and policy tests     |
| Output                   | Artifact only; no PR comment, patch, push, merge, or deployment            | Enforced in workflow and policy tests     |

The specific OpenAI action allowance is an intentional, narrow evolution of ADR-020's GitHub-owned-only baseline. Keep
`verified_allowed=false`, keep SHA pinning required, and do not add wildcard organizations or Marketplace actions. Enabling
the advisory also authorizes selected CI diagnostics to be sent to the configured OpenAI API account. Record the verifier
and date after applying the external setting; until then the workflow must remain disabled.

External Actions policy verified through the GitHub repository API by Codex on 2026-08-21 JST. The advisory remains
disabled because the owner-managed API credential is absent; adding that credential and enabling the variable require a
separate owner decision.
