# Agent control checklist

Repository source can define safe defaults, but it cannot prove owner-managed GitHub/Codex settings remain active. Verify
this checklist after Actions policy, credential, ownership, visibility, or plan changes and before enabling the advisory.

| Control                  | Required state before use                                                 | Current repository state (2026-09-01 JST) |
| ------------------------ | ------------------------------------------------------------------------- | ----------------------------------------- |
| Codex advisory trigger   | Human selects an exact failed CI run with `Run workflow`                  | Manual `workflow_dispatch` only           |
| API credential           | `OPENAI_API_KEY` Actions secret owned and rotated by the repository owner | Absent; advisory remains disabled         |
| Action source            | `openai/codex-action` at the ADR-pinned full commit SHA                   | Pinned in workflow source                 |
| Allowed Actions          | GitHub-owned actions plus only `openai/codex-action@*`                    | Enforced by GitHub setting                |
| SHA pinning              | Full commit SHA required                                                  | Enforced by GitHub setting                |
| Workflow token           | `actions: read`, `contents: read`; no write permission                    | Enforced in workflow and policy tests     |
| Codex permission profile | `:read-only` with `drop-sudo`                                             | Enforced in workflow and policy tests     |
| Output                   | Artifact only; no PR comment, patch, push, merge, or deployment           | Enforced in workflow and policy tests     |

The specific OpenAI action allowance is the sole owner-managed exception documented by ADR-022. Keep SHA pinning required
and do not add wildcard organizations or Marketplace actions. Adding the API credential and manually dispatching the
workflow authorizes the selected CI diagnostics to be sent to the configured OpenAI API account. Record the verifier and
date after applying the external setting; until then the deterministic classifier artifact is the only available output.

External Actions policy was verified through the GitHub repository API on 2026-09-01 JST. The advisory remains unable to
call the model because the owner-managed API credential is absent; adding that credential requires a separate owner
decision.
