# Music Queue Release-Row Hierarchy Design

Status: **Implemented 2026-07-26.**

## Purpose

Music Queue is the normal progress surface for releases Harmoniarr is trying to
add. Its rows must answer three questions during a quick scan:

1. What is happening now?
2. What release is affected?
3. Does the user need to act?

The previous rows repeated the same state through a badge, several pills,
progress chips, quality text, a timestamp, and two actions. That made normal
automatic progress look like a diagnostics workbench.

This change applies only to the release list. The selected release review panel
continues to contain the full match and quality evidence.

## Research

The implementation follows these current sources, reviewed July 2026:

- [Apple Human Interface Guidelines: Design principles](https://developer.apple.com/design/human-interface-guidelines/design-principles)
  recommends including only what is necessary, establishing a clear hierarchy,
  and using recognizable controls.
- [Apple Human Interface Guidelines: Feedback](https://developer.apple.com/design/human-interface-guidelines/feedback?changes=_9)
  recommends feedback near the affected item and presentation proportional to
  its significance.
- [Apple Human Interface Guidelines: Lists and tables](https://developer.apple.com/design/human-interface-guidelines/lists-and-tables)
  recommends list structures that support scanning and disclosure for deeper
  detail.
- [WCAG 2.2](https://www.w3.org/TR/WCAG22/) requires controls to remain
  operable, status and state not to rely solely on color, and supported targets
  to meet minimum target-size guidance.

## Options Considered

### Keep the existing chip-heavy row

Pros: all currently projected data stays visible.

Cons: repeated state competes with the release title and next action, low-value
zero or internal metrics crowd routine progress, and quality stops do not have
enough visual distinction.

### Hide quality from the release list

Pros: the list becomes simpler.

Cons: hides a user policy that can stop automation, especially for strict
lossless profiles. This conflicts with the requirement that quality choices are
understandable without opening diagnostics.

### Adopt an outcome-first release row

Pros: keeps one state, release identity, a short explanation, two compact
facts, and one primary action; makes quality attention explicit only when it
changes automation; retains full evidence in the selected review panel.

Cons: raw match count and other diagnostics require opening Details. This is
intentional because those details are evidence, not ordinary queue work.

## Decision

Adopt the outcome-first row.

Each row contains:

- a state marker and text label, plus a concise update label;
- release title, artist, type, and year;
- one bounded explanation of the current outcome;
- track progress and quality profile as plain facts;
- an emphasized quality fact only for `Quality choice needed`, below-minimum,
  or unverified-quality stops;
- one primary outcome action and a secondary `Details` action.

Status is communicated through text and the marker; color is supplementary.
Normal rows never show raw candidate IDs, source users, file paths, provider
payloads, or multi-stage execution controls. `Details` retains access to the
existing selected-release review panel instead of creating another route or API
surface.

The row is implemented as `MusicQueueReleaseRow.vue` with a pure
`music-queue-release-row-presentation.js` helper. The normalized queue contract
now preserves expected and matched track counts, so the compact progress fact
does not confuse complete coverage with no match evidence.

## Security And Accessibility

- This is a client-only presentation change. It adds no mutation, route, API,
  authorization boundary, or provider data.
- Actions retain existing native buttons and RouterLink navigation. They use the
  existing authorization and CSRF-protected flows.
- The quality stop is explicit text, not a color-only signal.
- The component stacks its actions on narrow screens and browser proof asserts
  it introduces no horizontal overflow.
- Detailed match/provider information remains confined to the existing review
  and advanced diagnostic boundaries.

## Validation

- `npm run lint:client`
- `npm run lint:test`
- `node --test test/client/music-queue-release-row-presentation.test.js`
- `npm run build:client`
- `node --test --test-concurrency=1 test/browser/music-queue-release-row-hierarchy-browser-verification.test.js`

The browser proof covers a normal downloading release and a quality-verification
stop at desktop and mobile widths, verifies the review handoff, and records
desktop/mobile visual evidence.

## Follow-up

The next high-value UI slice is **Music Queue summary and filter hierarchy
cleanup**. The mobile visual proof shows six summary cards, including multiple
zero states, can push the first queued release below the initial viewport. The
follow-up should collapse inactive summaries into one concise status sentence
or an on-demand breakdown while keeping active work and `Needs help` visible.
