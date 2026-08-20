# Quality harness

TypeLoop treats command output, tests, and CI status as evidence. An agent's statement that a change is safe is never a substitute for a passing gate.

## Validation ladder

| Stage       | Command                    | Purpose                                                                   |
| ----------- | -------------------------- | ------------------------------------------------------------------------- |
| Deps        | `npm run check:deps`       | Every declared peer range is satisfiable by the pinned versions           |
| Bundle      | `npm run check:bundle`     | JavaScript, CSS, social art, and install icons stay inside named budgets  |
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
covered by Playwright rather than being silently omitted from the denominator.

Node tests are co-located under `src` and use `*.test.ts` or `*.spec.ts`; add `.integration` before that suffix for
integration tests. The runner fails when either group is empty, rejects TSX tests, and rejects tests under `app` because
Node strip-types does not transform JSX. UI behavior belongs in Playwright unless a JSX-capable unit runner is deliberately
introduced.

Use `npm run check:quick` while iterating, `npm run check` before review, and `npm run check:ci` for the complete local CI equivalent. Install the browsers once with `npm run e2e:install` (Chromium and WebKit).

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
is introduced later; this local-first product does not currently send telemetry. Full all-screen fluid traversals have a
60-second per-viewport budget because each test intentionally visits up to sixteen application states in one browser context.

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

`scripts/triage-ci-failure.mjs` maps the failed job log onto a known cause, states
whether it is mechanically fixable, and comments the evidence and the next command
on the pull request. Causes marked blocking — dependency conflicts, tracked
secrets, high-severity advisories — also fail the triage job, so "do not merge" is
visible as a check and not only inside a log.

### Autofix (`.github/workflows/autofix.yml`)

Applies `npm run format` and `eslint --fix`, verifies the result with
`npm run check:quick`, then pushes an `[autofix]` commit to the same branch. It is
limited to same-repository branches, skips its own commits, and skips dependabot
branches. Nothing that needs a decision is ever rewritten.

A `GITHUB_TOKEN` push does not start a new workflow run, so the job comments that CI
needs re-running on the new commit. Add `[skip autofix]` to a pull request title to
opt out.

### What the automation deliberately does not do

Dependency conflicts are not auto-fixed. Choosing between pinning a dependency back
and upgrading the whole constraint is a judgement about the toolchain, and guessing
would produce a green build on a tree nobody chose. `npm run check:deps` names the
conflict, dependabot ignores keep known-incompatible majors out, and the triage
comment marks the pull request unmergeable — the decision stays with a person.
