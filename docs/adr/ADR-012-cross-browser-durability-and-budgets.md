# ADR-012: Cross-browser proof, storage durability, and measurable budgets

## Context

Four gaps were measured after the mobile input work landed.

1. **E2E ran only on Chromium.** `playwright.config.ts` declared no projects and
   `e2e:install` fetched Chromium alone. The software-keyboard handling targets
   Safari's behaviour — `visualViewport` as the only keyboard signal, fixed content
   Safari does not reflow for the keyboard, focus that opens the keyboard only inside
   a gesture — so the riskiest code ran on the least-tested engine.
2. **A version bump would have deleted every player's history.** The reader returned
   an empty envelope whenever the stored `version` differed from the current one, and
   a local-first app holds that data nowhere else.
3. **Real accessibility was unmeasured.** `eslint-plugin-jsx-a11y` reads source, so it
   cannot see a contrast ratio, a label hidden by a media query, or an ARIA attribute
   invalid for the computed role. Running axe found all three.
4. **No size budget existed.** First-load JavaScript measured 429 KB with nothing
   preventing that from doubling.

## Decision

**Run E2E on WebKit as well as Chromium.** WebKit is treated as required coverage, not
a nice-to-have, because it is the engine the keyboard behaviour was written for.

**Salvage stored data instead of resetting it.** `storage-envelope.ts` reads any
payload into the current envelope, keeping every session that still validates,
whatever version wrote it. The envelope version describes the envelope; session
records are read field by field, so adding a field to `CompletedSession` needs no
version bump and invalidates nothing. An envelope change that genuinely cannot be
salvaged must add an explicit upgrade step rather than widening the fallback.

**Gate accessibility on rendered pages.** `e2e/accessibility.spec.ts` runs axe over
every screen on every engine at a phone viewport and fails on critical or serious
violations. Moderate and minor findings are reported without gating so the signal
stays actionable. Fixing the findings changed three things: the sound toggle gained an
`aria-label` because its visible text is hidden on small screens, the timer bar became
a real `progressbar` instead of a `div` carrying a prohibited `aria-label`, and the
palette moved so badge and caption text passes AA — dark ink on the coral fill
(5.7:1, matching the sibling badges on cyan) and a darker `--muted` (5.2:1).

**Budget the shipped JavaScript.** `check:bundle` reads the build manifest, so lazily
loaded dictionaries are not charged against first paint and content-hashed filenames
do not matter. Budgets sit just above the measured sizes; raising one is a decision
that belongs in a pull request.

**Extract the keystroke tally.** The accounting that decides score, accuracy, and
combo moved out of the React callback into `application/session/tally-typing-steps.ts`.
It is a documented compatibility surface and was only reachable through a browser;
as a pure function it is asserted directly.

## Alternatives

- **Trust the mobile work without WebKit.** Rejected: the code exists because of
  Safari-specific behaviour, so Chromium alone proves nothing about it.
- **Add a migration framework now.** Rejected as speculative. Salvaging readable
  sessions solves the actual data-loss risk; a real upgrade step can be added when a
  real incompatible change exists.
- **Silence `scrollable-region-focusable` instead of fixing it.** Rejected: the list
  genuinely was not keyboard operable. It now carries a `tabindex` and a name, and the
  lint rule that forbids that was configured — once, with the reason — rather than
  disabled at the call site.
- **Darken only the failing badges.** Rejected for `--muted`: the same value failed at
  caption sizes in several places, so the token moved rather than its usages.
- **Build a JSX test harness for component tests.** Rejected for now, see below.

## Consequences

The mobile keyboard path is proven on the engine it targets, stored history survives
schema evolution, accessibility regressions fail the build, and bundle growth is
visible. Unit and integration tests went from 88 to 102, E2E from 8 to 30 checks
across two engines.

`--muted` and the coral badges changed colour. That is a visible design change, made
because the previous values failed WCAG AA at the sizes they were used at.

`@axe-core/playwright` is a new devDependency. `axe-core` itself is not declared: it
arrives as that package's own dependency, and knip correctly flagged the duplicate.

**Component-level tests remain absent, deliberately.** Node's type-stripping runner
cannot execute JSX, so the options were a bespoke `tsc`-then-run step or an
experimental Playwright component-testing dependency. Both add machinery whose
assertions would largely restate what the 30 cross-browser E2E checks already prove.
Raising the coverage of consequential logic by extracting it — as the keystroke tally
was extracted — was judged the better return. Presentation-layer line coverage stays
low as a result; the number reflects untested markup, not untested behaviour.
