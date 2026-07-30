# Music Queue Match Decision Evidence Design

Status: **Implemented 2026-07-29.**

## Problem

The selected-release review hierarchy is already outcome-first, but an
actionable match still renders every available fact and quality row before its
actions. Score, file count, transfer size, source health, and detailed quality
evidence are useful when comparing a difficult choice, but they obscure the
normal question: is this match suitable to use for this release?

The normal decision card must remain release-scoped and safe. It must not hide
the quality, transfer, or provider evidence an operator may need, and it must
not change automatic selection, existing actions, route state, or server-side
authorization.

## Existing Contract

- `acquisition-pipeline-presentation.js` builds a normalized match card with
  quality, format, track coverage, score, file count, transfer size, source
  health, and bounded quality evidence.
- `MusicQueueReviewMatchCard.vue` is used only by the selected-release review
  panel, both for actionable match choices and already-advanced evidence.
- Existing `Use this match` and `Reject match` intents remain owned by the
  parent view, which retains release-scoped server authorization and CSRF
  enforcement.
- The outer review panel already provides `Show matching and quality details`
  for aggregate evidence and diagnostics.

## Research

Sources were checked on 2026-07-29 against the requested June 2026 baseline.

| Source | Applied guidance |
| --- | --- |
| [W3C WCAG 2.2: Headings and Labels](https://www.w3.org/WAI/WCAG22/Understanding/headings-and-labels) | Name the card, decision facts, actions, and optional evidence by their purpose rather than by internal matching terminology. |
| [W3C WCAG 2.2: Focus Order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html) | Keep DOM order meaningful: match identity, decision facts, actions, then optional evidence. |
| [W3C WAI-ARIA Authoring Practices: Disclosure](https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/) | Keep detailed evidence behind a keyboard-operable disclosure rather than a visually hidden or custom-only panel. |
| [W3C WCAG 2.2: Focus Not Obscured](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html) | Ensure the compact card and its disclosure remain usable in the narrow review panel without obscuring the focused control. |
| [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html) | Do not add client-side logging or promote raw provider evidence outside the authenticated review boundary. |

## Options

### Keep every match fact visible

Pros: no extra interaction is needed to inspect a source.

Cons: decision cards remain dense, actions appear after evidence, and narrow
layouts make routine decisions look like diagnostics.

### Hide all match evidence behind the outer review disclosure

Pros: the action area becomes very short.

Cons: an operator choosing among matches loses relevant format and coverage
information and must navigate away from the choice context.

### Keep decision facts visible and disclose full match evidence

Pros: quality fit, format, and track coverage answer the ordinary selection
question; action controls are immediately visible; detailed quality and source
evidence remains one standard disclosure away on the same card.

Cons: an operator needs one extra interaction to inspect score, files, size,
source health, and detailed verification evidence.

## Decision

Adopt the third option through a small pure presentation module and a focused
component update:

1. A pure ESM card-presentation module classifies visible decision facts and
   optional evidence from the existing normalized match card.
2. Actionable cards show only `Quality`, `Format`, and `Tracks` before their
   existing `Use this match` and `Reject match` controls.
3. Each actionable card offers a closed native `Match details` disclosure for
   score, files, size, source health, and detailed quality verification rows.
4. Cards rendered within the outer matching-and-quality evidence disclosure
   retain their complete fact set because that surface is already explicitly
   advanced.
5. The existing parent-owned actions, route behavior, API calls, and server
   authorization remain unchanged.

## Security And Accessibility

- Presentation only: no provider call, persistence, mutation endpoint, route,
  authorization rule, or secret-data path is added.
- Native buttons retain keyboard operation for mutations; the evidence toggle
  uses a native disclosure with a visible label and logical focus order.
- Actions appear before optional evidence in DOM order.
- Status and quality retain explicit text; tone remains supplementary.
- Raw source evidence remains limited to the authenticated selected-release
  review and advanced diagnostics, and no new logging is added.

## Verification Plan

- Pure client coverage proves decision cards expose exactly the three decision
  facts and retain all other facts as evidence.
- Browser coverage proves actions precede the closed `Match details`
  disclosure, keyboard activation opens it, all evidence is available after
  expansion, and mobile width has no horizontal overflow.
- Client/test lint, ESM checks, production build, full tests, production
  dependency audit, and a no-cache local Docker walkthrough rebuild are release
  gates.

## Outcome

- Actionable match cards now lead with `Quality`, `Format`, and `Tracks`, then
  preserve the existing release-scoped `Use this match` and `Reject match`
  actions.
- `Match details` is a closed native disclosure containing score, file count,
  transfer size, source health, and detailed quality evidence. Existing
  evidence-only cards remain complete because they are already inside the
  outer advanced disclosure.
- Focused pure-presentation and browser coverage proves the compact/default,
  expanded, keyboard, desktop, and mobile contracts. Client/test lint and the
  production client build also pass.

## Follow-up

Assess release-scoped action feedback in Music Queue. Current mutation success
and failure messages are emitted above the entire queue, which can separate
feedback from the selected release action that caused it.
