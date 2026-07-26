# Music Queue Review Hierarchy Design

Status: **Implemented 2026-07-26.**

## Purpose

The selected-release panel is the final normal-path Music Queue surface a
person sees after a row says it needs attention. It previously placed the
release state, every available match, a six-row match summary, fourteen
quality facts, action buttons, and a diagnostics link in one uninterrupted
panel. That treated evidence as the primary task and made the relevant next
step difficult to identify.

This change keeps every existing release-scoped action and evidence field, but
orders them as outcome, decision, and optional evidence.

## Research

The implementation follows these current official references:

- [W3C WAI-ARIA Authoring Practices: Disclosure](https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/)
  defines the native button disclosure pattern used for matching and quality
  details, including its expanded state.
- [W3C WCAG 2.2: Info and Relationships](https://www.w3.org/WAI/WCAG22/Understanding/info-and-relationships.html)
  requires relationships conveyed visually to remain programmatically
  determinable. The panel therefore uses headings, sections, lists, and
  definition lists rather than visual grouping alone.
- [W3C WCAG 2.2: Focus Order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html)
  supports the outcome-to-action-to-evidence DOM order so keyboard focus follows
  the same sequence as visual reading.
- [W3C WCAG 2.2: Target Size (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html)
  supports retaining the application's button primitives for explicit actions
  and the evidence toggle.
- [Apple Human Interface Guidelines: Disclosure controls](https://developer.apple.com/design/human-interface-guidelines/disclosure-controls)
  supports keeping optional detail available without presenting it as the
  default task.

## Options Considered

### Keep every detail visible

Pros: no extra interaction is required; existing evidence remains immediately
visible.

Cons: repeated state and quality information obscure the one action that moves
the release forward, especially in a narrow panel or on a phone.

### Hide all match and quality detail behind Advanced diagnostics

Pros: the normal panel becomes very short.

Cons: it removes useful release evidence from the immediate workflow and forces
ordinary troubleshooting into a diagnostics route.

### Outcome first, decision second, evidence by disclosure

Pros: explains the release state and next step before controls, keeps genuine
user decisions visible, retains all match and quality evidence on the same
route, and makes diagnostics a deliberate escalation.

Cons: a person must expand one disclosure to inspect non-actionable matches or
the complete quality policy.

## Decision

Adopt the third option through focused ESM modules:

- `MusicQueueReviewPanel.vue` owns the selected-release hierarchy and the
  native disclosure state.
- `MusicQueueReviewMatchCard.vue` owns reusable detailed match evidence and
  match-selection actions.
- `music-queue-review-presentation.js` is a pure classification layer that
  decides whether matches are decision content or evidence content.

The resulting hierarchy is:

1. **Current status**: a textual status, reason, and plain-language next step.
2. **Continue this release** or **Choose a match**: only actions that can move
   the selected release forward, with the three quality facts relevant to a
   quality stop.
3. **Matching and quality details**: a button-controlled disclosure containing
   match cards when no match choice is required, aggregate match evidence, the
   complete quality policy, and the Advanced diagnostics handoff.

When Harmoniarr needs a match choice, the actionable match cards remain in the
decision section rather than being duplicated under evidence. Normal automated
states remain calm but still retain their evidence in the disclosure.

## Security And Accessibility

- The change is presentation-only: it creates no API, provider, authorization,
  or secret-data surface.
- Existing parent handlers still execute release- and match-scoped mutations;
  this component emits intent only. CSRF and server-side authorization remain
  the enforcement boundary.
- The disclosure uses a native button with `aria-expanded` and `aria-controls`.
- Status is expressed as text and context, not color alone.
- Sections have named headings; match cards use a list; facts use definition
  lists; and DOM order follows outcome, decision, then evidence.
- Browser proof covers both the collapsed and expanded states and asserts no
  mobile horizontal overflow.

## Validation

- `npm run lint:client`
- `npm run lint:test`
- `node --test test/client/acquisition-pipeline-presentation.test.js test/client/music-queue-review-presentation.test.js`
- `npm run build:client`
- `node --test --test-concurrency=1 test/browser/music-queue-release-row-hierarchy-browser-verification.test.js`
- `npm run test:client`

The browser scenario captures the normal queue, a stopped release with its
outcome-first review, and its expanded evidence state in desktop and verifies
the expanded evidence remains within the mobile viewport.

## Recommendation Stack

1. Keep Music Queue release rows and selected reviews outcome-first.
2. Show a release-scoped action only when human intervention is required.
3. Keep scoring, match evidence, and complete quality policy available through
   an accessible disclosure on the same route.
4. Reserve Advanced diagnostics for cross-release investigation, not routine
   use.

## Follow-up

The next high-value UI slice is **Music Queue waiting and empty-state
hierarchy**: distinguish automatic waiting, provider/setup blockers, and a
truly empty queue without adding another dashboard or requiring the Activity
workspace for interpretation.
