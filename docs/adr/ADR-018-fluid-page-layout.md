# ADR-018: Fluid page layout contract

## Context

TypeLoop has several distinct experiences: a compact home workspace, long glossaries, a focused typing game, and a multi-step assessment. Each screen previously owned its page width, outer margin, and viewport padding. That made local tuning easy, but duplicated the same responsibility across global CSS and screen styles. A new route could silently choose a different breakpoint or lose its minimum gutter, and verifying one screen did not prove the others remained usable at narrow, short, or very wide viewports.

The product needs continuous sizing rather than a growing set of device-specific layouts. At the same time, reading, game, assessment, and catalogue screens should not all share one arbitrary maximum width.

## Decision

Application-level layout flows through one presentation component, `PageShell`:

```text
viewport and safe area
  → root fluid layout tokens
    → PageShell width and spacing contract
      → screen-owned internal Grid/Flex composition
```

- `app/styles/themes.css` owns viewport gutters, vertical rhythm, and the named content-width scale.
- `PageShell` is the only owner of application-level `<main>`. Its required `width` property selects a semantic layout role: `wide`, `default`, `reading`, `assessment`, `session`, `game`, or `compact`.
- Screens may select standard, compact, or zero block spacing and may request centered content. They do not repeat outer width, auto margins, or viewport padding.
- Page gutters use logical properties, `clamp()`, dynamic viewport units, and safe-area insets. The shell exposes an inline-size container so future components can respond to their available workspace rather than the device width.
- Inner screen composition stays with the screen that owns it. The shared shell deliberately does not encode feature grids, card dimensions, or content order.
- Repository tests reject application screens that bypass `PageShell`. Browser tests exercise every shell role at compact phone and desktop sizes, representative screens across the intermediate and wide classes, and verify continuous gutter and height-based rhythm changes.

## Alternatives

### Keep per-screen media queries

Rejected because outer layout policy would remain duplicated, and new screens could not inherit fixes for safe areas, gutters, or future width changes.

### Use one global CSS class on every `<main>`

Rejected because a string class does not require a width decision, cannot express the contract through TypeScript, and is easy to omit without a structural test.

### Use JavaScript viewport measurements

Rejected because CSS already handles continuous resizing without hydration work, resize listeners, or theme-specific React branches. JavaScript remains reserved for behavior CSS cannot express.

### Give every page the same maximum width

Rejected because scan-heavy catalogues, focused sessions, and prose-heavy results have materially different readable measures.

## Consequences

- Changes to global sizing propagate from the token registry through every route.
- New screens must choose an explicit shell role before implementing their internal layout.
- Global fixes no longer require editing every screen, while feature-specific grids remain independently evolvable.
- Width roles are a small API that must remain semantic; adding a role requires evidence that no existing role expresses the need.
- Browser coverage takes longer because compact and desktop classes traverse every application screen, but it protects the product-level contract rather than a single landing page.
