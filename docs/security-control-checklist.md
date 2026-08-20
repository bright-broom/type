# Security control checklist

Repository code cannot prove that owner-managed GitHub settings remain enabled. Re-run this checklist after a visibility, plan, ownership, Actions policy, dependency policy, or credential change and before a production release.

## Last verified: 2026-08-20 JST

| Control                     | Required state                                        | Observed state                            | Evidence method                                        |
| --------------------------- | ----------------------------------------------------- | ----------------------------------------- | ------------------------------------------------------ |
| Dependabot alerts           | Enabled                                               | Enabled                                   | GitHub vulnerability-alerts API returned HTTP 204      |
| Automated security fixes    | Enabled and not paused                                | Enabled                                   | GitHub automated-security-fixes API returned `enabled` |
| Allowed Actions             | GitHub-owned plus documented owner-managed exceptions | GitHub-owned plus `openai/codex-action@*` | Actions permissions and selected-actions APIs          |
| Action reference pinning    | Full commit SHA required                              | Enforced                                  | Actions permissions API `sha_pinning_required: true`   |
| HSTS scope                  | Exact deployed host only                              | Enforced                                  | Effective browser header test                          |
| HSTS subdomains and preload | Disabled until ownership verified                     | Disabled                                  | Authored and effective header tests                    |

Verified by: repository owner-authorized Codex session. The OpenAI exception is reserved for the separately reviewed agent-control workflow and remains subject to full-SHA pinning; no other third-party pattern is allowed. Reverification must record the new date and verifier in this file. Do not broaden Actions, HSTS, CSP, or Permissions Policy as a convenience fix; document the consumer and risk in an ADR first.
