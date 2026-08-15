# Quality harness

TypeLoop treats command output, tests, and CI status as evidence. An agent's statement that a change is safe is never a substitute for a passing gate.

## Validation ladder

| Stage       | Command                    | Purpose                                                            |
| ----------- | -------------------------- | ------------------------------------------------------------------ |
| Format      | `npm run format:check`     | Deterministic authored-file formatting                             |
| Lint        | `npm run lint`             | TypeScript, React, hooks, accessibility, and Next.js rules         |
| Typecheck   | `npm run typecheck`        | Strict TypeScript contracts                                        |
| Unit        | `npm run test:unit`        | Pure domain, reducer, and content behavior                         |
| Integration | `npm run test:integration` | Cross-module, repository policy, and infrastructure behavior       |
| Coverage    | `npm run test:coverage`    | All authored `src` modules, including zero-hit files, with floors  |
| Dead code   | `npm run check:dead-code`  | Unused files, exports, and dependencies                            |
| Build       | `npm run build`            | Next.js production compilation                                     |
| Browser     | `npm run test:e2e`         | Critical flows, responsive overflow, console, and request failures |
| Security    | `npm run check:security`   | Tracked-secret heuristic and High dependency audit                 |

Coverage uses c8's all-source mode. It includes zero-hit authored runtime modules under `src`, while excluding generated
datasets, tests, type-only contracts, application ports, and the compatibility export facade. Browser behavior remains
covered by Playwright rather than being silently omitted from the denominator.

Node tests are co-located under `src` and use `*.test.ts` or `*.spec.ts`; add `.integration` before that suffix for
integration tests. The runner fails when either group is empty, rejects TSX tests, and rejects tests under `app` because
Node strip-types does not transform JSX. UI behavior belongs in Playwright unless a JSX-capable unit runner is deliberately
introduced.

Use `npm run check:quick` while iterating, `npm run check` before review, and `npm run check:ci` for the complete local CI equivalent. Install Chromium once with `npm run e2e:install`.

## Bug fixes

1. Reproduce the symptom deterministically.
2. Add a test that fails for the observed reason.
3. Explain the owning layer and root cause.
4. Apply the smallest compatible fix.
5. Run the regression test and the full gate.

If automation is impossible, record the manual reproduction and why a stable test cannot be written. Do not silently skip the regression step.

## Independent review loop

1. The implementation agent runs the tests and provides the diff plus evidence.
2. A separate `review-typeloop` reviewer inspects logic, architecture, tests, and security without editing.
3. The implementation agent fixes supported findings and reruns the affected tests plus `npm run check:ci`.
4. The reviewer verifies the fixes; use at most two fix/re-review rounds after the initial review.

Critical and High findings block completion. If either severity remains after fix/re-review round two, stop and report the repeated root cause or external blocker.

## Security boundary

The app has no backend, database, authentication, runtime environment variables, or network dependency. ESLint AST rules
guard against accidental direct browser, Node network, and common HTTP-client access. They are a regression guardrail, not
an adversarial-code sandbox; review and an ADR remain required for any boundary change. The tracked-secret scan covers the
current tracked/untracked snapshot, including generated content and the lockfile, but does not replace GitHub history
scanning or push protection. `npm audit` is registry-backed and may fail for operational reasons; CI keeps it in a separate
security job so the failure is explicit.

CodeQL, native Secret Scanning, push protection, branch rulesets, and Vercel production controls are repository/workspace settings. They must be verified by an owner before being described as enabled. Never print `.env`, credentials, tokens, or production data while diagnosing a gate.

## Dead-code cleanup

Knip findings are candidates, not deletion instructions. Confirm framework conventions, lazy imports, generated data, public assets, and runtime entry points before removal. Use the sequence: static finding → reference check → deletion plan → smallest deletion → full regression.
