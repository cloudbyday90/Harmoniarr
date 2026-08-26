# Music Queue Match Choice Clarity Design

Date: 2026-08-25

## Decision

Keep Music Queue's existing score-ordered, bounded match shortlist. Make the
shortlist boundary explicit and give repeated selection actions contextual
accessible names. The view remains a manual decision point: it never selects a
match or starts a download merely because it is ranked first.

## Local finding

The local walkthrough has one Music Queue release with 285 pending candidates.
The existing server read model correctly exposes only five score-ordered match
cards, but the panel described them as though they were the only choices. That
created an avoidable ambiguity before an action that can lead to a download.

## Official sources reviewed

- [W3C Labels or Instructions](https://www.w3.org/WAI/WCAG21/Understanding/labels-or-instructions)
  says labels and instructions should provide enough information to complete a
  task without unnecessary clutter. The panel now names the visible shortlist
  and the total candidate count.
- [W3C WCAG 2.2 Label in Name](https://www.w3.org/WAI/WCAG22/Understanding/label-in-name)
  supports keeping visible action words in accessible names. `Use this match`
  remains the prefix of each contextual action name.
- [W3C accessibility design tips](https://www.w3.org/WAI/tips/designing/)
  recommends easily identifiable feedback and prominent guidance when user
  action is required.
- [Playwright locators](https://playwright.dev/docs/locators) recommends role
  locators with accessible names, which the browser test now verifies.

## Options

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Render every candidate | Exposes the full set | Creates a large, repetitive, consequential action list | Rejected |
| Add pagination or a new search screen | Could expose more candidates | Adds state and controls before a real operator need is observed | Deferred |
| Keep the opaque five-card view | Smallest code change | Implies the shortlist is the full candidate set | Rejected |
| Explain the bounded shortlist and contextualize actions | Clear, accessible, no new workflow or request | Still intentionally limits initial review to ranked matches | Chosen |

## Final stack

- Match count projection: `src/client/lib/acquisition-pipeline-presentation.js`
- Review-copy projection: `src/client/lib/music-queue-review-presentation.js`
- Accessible action-name projection: `src/client/lib/music-queue-match-card-presentation.js`
- Review components: `src/client/components/music-queue/`
- Focused tests: `test/client/music-queue-*.test.js` and
  `test/browser/music-queue-release-row-hierarchy-browser-verification.test.js`

## Security boundary

This change is presentation-only. Match selection remains an authenticated,
fresh-session, CSRF-protected, idempotent server mutation. The UI does not
reveal additional peer, path, or provider data, and it does not enqueue a
transfer.
