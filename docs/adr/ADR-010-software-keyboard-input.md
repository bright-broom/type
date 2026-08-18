# ADR-010: Software keyboard input on touch devices

## Context

The session was reachable on a phone but not playable. Three defects made it a dead
end, all confirmed by measurement before the change:

1. Nothing was ever focused (`document.activeElement` stayed `body` through the
   countdown and the whole session), so no software keyboard opened. The only way
   in was to notice a small field below the prompt and tap it while the 60-second
   clock was already running.
2. Kana was discarded silently. A keyboard left in Japanese mode produced no typed
   characters, no miss, and no message — indistinguishable from a broken app.
3. Nothing accounted for the keyboard's height. The field sat at y≈695 of an
   844px viewport, below where a keyboard appears, so opening it scrolled the
   prompt and the romaji guide out of view.

A software keyboard can only be opened from script while a user gesture is still
being handled. That constraint, not styling, dictates the design.

## Decision

**Own the typing field at the session composition boundary and focus it from the
gesture.** `TypingApp` holds the field's ref and calls `focus()` synchronously
inside the tap handlers for start and resume. The field is mounted for the whole
app lifetime, because focusing an element React has not created yet would land
outside the gesture; outside a session it is inert (`aria-hidden`, `tabIndex={-1}`,
translated off-screen) rather than `display: none`, which would make it
unfocusable.

**Treat a dismissed keyboard as recoverable.** A pointer-down on the play area
re-focuses the field, suppressing the default focus shift that would otherwise
undo it. Taps that carry their own gesture — controls and the scrollable prompt
description — are left alone.

**Report unusable input instead of dropping it.** `normalizeTypedText` in the
domain splits raw input into engine-consumable keys and rejected characters. When
nothing usable arrives, the session raises an `unsupported` feedback state and the
UI asks the player to switch keyboard mode. Rejected characters are deliberately
**not** counted as misses: a keyboard-mode problem is not a typing mistake and
must not move the accuracy figure.

**Publish keyboard geometry to CSS, and react to it in CSS.** `visualViewport` is
the only reliable source — no media query reports a keyboard and iOS does not
reflow fixed content for it. `useKeyboardInset` writes `--keyboard-inset` and
`data-keyboard` onto the root element; the stylesheet lifts the input dock above
the keyboard and, while it is open, drops the live stats, footer, and prompt
description so the timer, prompt, and romaji guide stay visible.

## Alternatives

- **Keep the field inside `GameScreen`.** Rejected: it does not exist at the
  moment of the start tap, so the keyboard cannot open with the gesture.
- **Focus from an effect after the countdown.** Rejected: effects run in a later
  task, and mobile browsers ignore `focus()` there.
- **Accept kana directly against the hiragana reading.** A genuine feature, but it
  changes the domain's romaji matching contract and is out of scope here.
- **Count rejected characters as misses.** Rejected: it would penalise accuracy
  for a keyboard-mode problem and hide the cause.
- **Detect the keyboard with a media query or a fixed height guess.** Rejected: no
  media query exists and keyboard heights vary by device, language, and prediction
  bar.

## Consequences

Play starts with the keyboard already open, a dismissed keyboard is one tap away,
and a Japanese-mode keyboard now explains itself. `keyboardInsetFrom` and
`normalizeTypedText` are pure and unit-tested, and the mobile flow — focus through
countdown, resume, kana guidance, and layout inside the space a keyboard leaves —
is covered by Playwright.

Desktop behaviour is unchanged: the dock is `display: none` there, so `focus()` is
a no-op and physical keystrokes keep flowing through `useKeyboardInput`. Because
the field can hold focus for a whole session, `useKeyboardInput` now treats it as a
non-foreign target so `Enter` and `Escape` still reach the session on tablets with
a hardware keyboard.

The OS keyboard itself cannot be asserted in CI. The tests verify focus ownership
and layout, which are the conditions the browsers document for opening it; the
gesture behaviour still warrants a check on real hardware.
