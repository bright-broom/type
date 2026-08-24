# Quality harness

TypeLoop treats command output, tests, and CI status as evidence. An agent's statement that a change is safe is never a substitute for a passing gate.

## Validation ladder

| Stage       | Command                    | Purpose                                                                   |
| ----------- | -------------------------- | ------------------------------------------------------------------------- |
| Deps        | `npm run check:deps`       | Every declared peer range is satisfiable by the pinned versions           |
| Bundle      | `npm run check:bundle`     | JavaScript, CSS, social art, and install icons stay inside named budgets  |
| Content     | `npm run check:content`    | Takken source provenance and qualified publication evidence               |
| Privacy     | `npm run check:privacy`    | Public runtime source excludes restricted content and personal addresses  |
| Tokens      | `npm run check:tokens`     | Design colors exist only inside the theme registry; TSX carries none      |
| Format      | `npm run format:check`     | Deterministic authored-file formatting                                    |
| Lint        | `npm run lint`             | TypeScript, React, hooks, accessibility, and Next.js rules                |
| Typecheck   | `npm run typecheck`        | Strict TypeScript contracts                                               |
| Unit        | `npm run test:unit`        | Pure domain, reducer, and content behavior                                |
| Integration | `npm run test:integration` | Cross-module, repository policy, and infrastructure behavior              |
| Coverage    | `npm run test:coverage`    | All authored `src` modules, including zero-hit files, with floors         |
| Dead code   | `npm run check:dead-code`  | Unused files, exports, and dependencies                                   |
| Build       | `npm run build`            | Next.js production compilation                                            |
| Static      | `npm run check:static`     | Every route is prerendered and theme bootstrap precedes application paint |
| Browser     | `npm run test:e2e`         | Critical flows, responsive overflow, console, and request failures        |
| Security    | `npm run check:security`   | Tracked-secret heuristic and High dependency audit                        |

Coverage uses c8's all-source mode. It includes zero-hit authored runtime modules under `src`, while excluding generated
datasets, tests, type-only contracts, application ports, and the compatibility export facade. Browser behavior remains
covered by Playwright rather than being silently omitted from the denominator. Browser orchestration stays in hooks, while
stateful product decisions are extracted into application-owned pure transitions so their coverage is meaningful without
introducing a second JSX test runtime.

Node tests are co-located under `src` and use `*.test.ts` or `*.spec.ts`; add `.integration` before that suffix for
integration tests. The runner fails when either group is empty, rejects TSX tests, and rejects tests under `app` because
Node strip-types does not transform JSX. UI behavior belongs in Playwright unless a JSX-capable unit runner is deliberately
introduced. The authored-file line guard includes Playwright specifications and their support modules, so browser tests are
split by journey rather than accumulating in one catch-all file.

Use `npm run check:quick` while iterating, `npm run check` before review, and `npm run check:ci` for the complete local CI equivalent. Install the browsers once with `npm run e2e:install` (Chromium and WebKit).

## Takken content governance

`check:generated` reproduces the glossary byte-for-byte from its tracked normalized TSV. `check:content` then joins that artifact to the authored edition and official-source registries. Every source ID must resolve to an allowlisted RETIO, MLIT, or e-Gov HTTPS snapshot with retrieval and as-of dates plus a SHA-256 digest. Exam and legal-basis dates are manifest data, never importer literals.

The weekly `Takken official source monitor` workflow compares stable content windows on the highest-risk official pages and reconciles one deduplicated Issue on drift. It reports only URLs, dates, digests, and missing markers; it does not copy official text, alter the glossary, change an answer, or promote a question. Redirects and non-default-branch manual runs are rejected. `published` questions are accepted only when exact question and registry digests have an Ed25519 review attestation signed by a reviewer whose qualification and category scope are stored in the owner-managed `TAKKEN_REVIEWER_KEYS_JSON` repository variable. An absent trust registry is an intentional default-deny state.

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

`check:privacy` is a confidentiality boundary for the current delivery tree. It rejects
known restricted meeting markers and personal email addresses from runtime source and
generated public content without printing matched values. `check:static` applies the
restricted-marker portion again to emitted client and route artifacts. This is defense in
depth for known disclosure classes, not a claim that regexes can discover every form of PII.
Before a repository visibility change, the separate history and owner-control gates in the
public-release review remain mandatory.

CodeQL, native Secret Scanning, push protection, branch rulesets, and Vercel production controls are repository/workspace settings. They must be verified by an owner before being described as enabled. Never print `.env`, credentials, tokens, or production data while diagnosing a gate.

Dependabot vulnerability alerts and automated security fixes were enabled on 2026-08-20. Repository Actions were restricted the same day to GitHub-owned actions plus the documented `openai/codex-action@*` exception, with full commit SHA pinning required. `tests/security-headers.test.mjs` guards the authored policy and `e2e/security-headers.spec.ts` verifies the effective production response in Chromium and WebKit. Re-check external settings with `docs/security-control-checklist.md` because repository code cannot make them immutable.

## Dead-code cleanup

Knip findings are candidates, not deletion instructions. Confirm framework conventions, lazy imports, generated data, public assets, and runtime entry points before removal. Use the sequence: static finding → reference check → deletion plan → smallest deletion → full regression.

## Design tokens

Every raw color is declared inside the `@tokens-begin` theme registry in
`app/styles/themes.css`.
Components reference `var(--token)`; translucent colors use the channel triplets
(`rgb(var(--ink-rgb) / 8%)`) so they stay tied to their base. Retuning the app's
tone is therefore an edit to one block, guarded three ways:

- `npm run check:tokens` rejects color literals outside the registry, a second
  unscoped `:root`, any color literal in TSX, and raw geometry or timing values in
  the modern product layer.
- `tests/design-tokens.test.mjs` asserts the core reading pairs meet WCAG AA and
  that `--*-rgb` triplets match their hex base, so a bad retune fails in
  milliseconds — before axe ever starts a browser.
- The axe E2E suite then verifies the rendered result.

This block exists because the palette had already forked once: a second `:root`
silently overrode nine tokens, stale rgb() literals kept spelling the old palette,
and four near-identical grays accumulated. The duplicate-value test keeps that
from recurring.

## Browser matrix

E2E runs on Chromium and WebKit, against the **production server** rather than
`next dev`. In development the dictionary chunks compile on demand, so the first test
to open a large glossary paid the compile cost — on a shared runner that pushed the
446-entry takken accessibility scan past the default timeout while it passed locally.
Serving the build removes that variance and means the suite exercises what ships, so
`npm run test:e2e` expects `npm run build` to have run (both `npm run check` and CI do).

The Core Web Vitals lab probe runs after the functional matrix in a dedicated single-worker Chromium phase. Event Timing
includes main-thread scheduling delay, so co-scheduling the probe beside full-screen WebKit/Chromium traversals measures
runner contention instead of the page. The gate therefore records two signals: product-owned event processing must remain
at or below 100 ms, while full Event Timing has a 500 ms hosted-runner safety ceiling that catches major regressions without
misrepresenting a shared VM as field INP. A 200 ms end-to-end target belongs to real-user monitoring if that privacy boundary
is introduced later; this local-first product does not currently send telemetry. Fluid-layout cases are isolated by screen,
so a slow or stateful route cannot consume the timeout budget or browser state of the rest of the viewport matrix.

CI runs the browser job inside the version-matched, digest-pinned Playwright
`noble` image. The image owns Chromium, WebKit, and their OS packages; do not add
`playwright install-deps` or a browser cache to the job. Linux OS packages are not
cacheable, and downloading them from the runner's APT mirror caused both timeout
exit `124` and an orphaned APT lock. The repository convention test keeps the npm
package version and image tag aligned.

E2E runs on Chromium and WebKit. WebKit is not optional: the software-keyboard
handling targets Safari's behaviour — `visualViewport` as the only keyboard signal,
fixed content that Safari does not reflow for the keyboard, and focus that opens the
keyboard only inside a gesture. Chromium cannot prove any of it.

`e2e/fluid-layout.spec.ts` treats responsive geometry as a product contract. It
traverses every screen at compact-phone and desktop widths, covers every semantic
page-shell role at intermediate and wide viewports, rejects document overflow and
internally clipped controls, and proves that root gutter and vertical-rhythm tokens
change continuously. Intentional scrollable rails are validated as reachable
overflow rather than mistaken for clipped controls.

`e2e/product-quality.spec.ts` checks effective install metadata, a fully interactive
and theme-consistent offline shell from both root and a query-bearing deep route, a rendered 11px floor for informative phone
text, and lab LCP, CLS, and single-interaction Event Timing budgets. The interaction
check requires a real positive interaction identifier, separately gates product-owned
processing and end-to-end hosted-runner latency, and is not presented as field INP. A source-wide CSS floor catches screens and pseudo-content outside the rendered
sample. These checks catch release regressions without introducing field telemetry or
sending local session data anywhere.

`e2e/visual-regression.spec.ts` owns platform-specific Chromium baselines for four
critical noir surfaces. macOS and Linux snapshots are intentionally separate because
system Japanese font rasterization differs. Update snapshots only in the pull request
that intentionally changes the design.

## Accessibility

`eslint-plugin-jsx-a11y` reads source and cannot see a contrast ratio, a label hidden
by a media query, or an ARIA attribute invalid for the role the browser computed.
`e2e/accessibility.spec.ts` runs axe over every screen on every engine at a phone
viewport, and fails on critical or serious violations. Moderate and minor findings are
reported without gating, so the signal stays actionable.

## Failure automation

Two workflows react to a failing gate. Both are deliberately narrow: the boundary is
whether a fix needs judgement.

### CI triage (`.github/workflows/ci-triage.yml`)

Runs on `workflow_run` after CI finishes, so it executes the classifier from the
default branch and never checks out the branch whose CI failed. That keeps it safe
to run for forks and for dependabot, which is precisely where the reporting matters.

`scripts/triage-ci-failure.mjs` maps the failed job log onto a known cause and states
whether it is mechanically fixable. Pull-request and Autofix-dispatched failures
receive a PR comment. `scripts/ci-triage-contract.mjs` fails closed on unexpected
classifier exits and owns incident identity. A repository-scoped serial reconciler
re-reads the latest `main` CI run before it opens, updates, or closes the one marked
Production Health issue; stale workflow completions cannot mutate it. On exact-SHA
CI success, `scripts/verify-production-release.mjs` waits for the matching successful
GitHub Production deployment and checks the canonical application inventory, every
recursively referenced same-origin shell asset, HTML shell, immutable full-SHA release
header, the retired route (including its 404 body), restricted-content policy, all
route security headers, and Service Worker cache boundary. An overall timeout stays
below the job budget; a later successful Production deployment status provides the
recovery signal. Its report contains only finding codes and public paths. The
reconciler owns no Vercel mutation capability. Repository and script-level contract
tests are both part of the coverage-mode CI discovery set.

### Autofix (`.github/workflows/autofix.yml`)

The trusted `pull_request_target` workflow has three capability-separated jobs. A
read-only prepare job checks out the exact PR SHA without credentials, applies
`npm run format` and `eslint --fix`, verifies `npm run check:quick`, and uploads only
a short-lived patch. A writer job executes no PR code: it rechecks the SHA, applies
the patch only to files already changed by the PR, and pushes an `[autofix]` commit.
A final job owns only Actions dispatch and PR notification.

A `GITHUB_TOKEN` push does not start a new workflow run, so Autofix dispatches CI
explicitly with the new commit SHA. CI rejects a dispatched run if GitHub resolves
the branch to a different SHA, preventing a stale green check from being mistaken
for validation of the Autofix commit. Add `[skip autofix]` to a pull request title
to opt out.

### What the automation deliberately does not do

Dependency conflicts are not auto-fixed. Choosing between pinning a dependency back
and upgrading the whole constraint is a judgement about the toolchain, and guessing
would produce a green build on a tree nobody chose. `npm run check:deps` names the
conflict, dependabot ignores keep known-incompatible majors out, and the triage
comment marks the pull request unmergeable — the decision stays with a person.

## Agent control plane

`.codex/hooks.json` gives trusted Codex clients an early local stop before a protected-branch push, PR merge, protected-ref
API mutation, or any Vercel CLI invocation while that tool's dependency audit is blocked. It complements GitHub rules; it
does not replace them and cannot govern other clients. Review repository hooks with `/hooks` before trusting a checkout.

`Codex CI advisory` is an optional second opinion after the deterministic classifier. It reads only the default branch and
failed-job artifact, runs with `contents: read` and the `:read-only` permission profile, and writes only a 14-day artifact.
It cannot change or comment on a pull request. The owner must explicitly set both `CODEX_CI_ADVISORY_ENABLED=true` and the
`OPENAI_API_KEY` Actions secret; otherwise no model call occurs. ADR-020's external Actions baseline must also be narrowed
to the single `openai/codex-action@*` pattern while full-SHA pinning remains required; `docs/agent-control-checklist.md`
records that prerequisite and keeps the switch disabled until it is verified.

`Quality metrics` runs weekly and can also be dispatched manually. Its 28-day artifact defines each denominator and reports
`n/a` instead of manufacturing a zero. The signals are initial CI success, median time to first green run, distinct reviewed
revision rounds, default-branch CI failures, the share of failures caught on PRs, and the merge rate of closed `codex/*`
pull requests. Closed PRs are associated to historical CI through their commit SHAs because GitHub removes the
`pull_requests` association from some completed run responses. They measure the delivery system, not people.
All merged PRs remain in the initial-CI denominator; an unassociated run is shown as missing and is not successful. Re-run
attempt 1 is recovered from its jobs endpoint, and failure detection counts a workflow run when any observed attempt failed.
API queries are date-bounded before pagination so report cost does not grow with repository age.

No Vercel CLI runner is exposed while the evaluated `59.1.4` dependency graph fails the High/Critical audit. `npm exec`
would not solve that problem because it re-resolves an unaudited transitive graph. Repository hooks deny every Vercel CLI
command; previews continue through the GitHub integration, and production remains human-owned. Revisit only with an isolated
lockfile or digest-pinned image and a dedicated audit gate. No repository workflow may merge or weaken a required gate.
