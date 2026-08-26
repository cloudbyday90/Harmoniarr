# Music Queue Match Selection Feedback Design

Date: 2026-08-25

## Decision

After an operator selects a Music Queue match, use the server-returned release
state to describe the next automatic handoff in the existing in-context status
message. If the response does not include a recognizable state, use a cautious
fallback that confirms the selection without claiming that a download was
queued or accepted.

## Finding

Music Queue already keeps mutation feedback in the selected release review,
uses a polite live region for normal progress, and restores keyboard focus when
an action disappears. Its successful match-selection message was static,
however: it said Harmoniarr would use the match for the next download step even
when the authoritative response could distinguish checking, downloading, or an
unknown handoff state.

## Official sources reviewed

- [W3C WCAG 2.2 Status Messages](https://www.w3.org/TR/wcag/#status-messages)
  requires status changes to be programmatically determinable without moving
  focus. The existing polite status region remains the announcement surface;
  this change improves the truthfulness of its content.
- [W3C Understanding Status Messages](https://www.w3.org/WAI/WCAG21/Understanding/status-messages.html)
  explains that status feedback should inform people without unnecessarily
  interrupting their work. The UI keeps the current focus-recovery behavior and
  does not navigate away to Downloader.
- [W3C Labels or Instructions](https://www.w3.org/WAI/WCAG21/Understanding/labels-or-instructions)
  supports concise, sufficient instructions. The result names the next known
  handoff rather than adding a second activity feed.
- [Playwright locators](https://playwright.dev/docs/locators) supports testing
  the visible status contract through roles and accessible names.

## Options

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Keep the static success message | Smallest code change | Can imply a download outcome that the response does not establish | Rejected |
| Derive copy from the returned release state | Accurate, compact, reuses the existing state projection | Requires an explicit safe fallback | Chosen |
| Redirect to Downloader after selection | Makes the handoff visible | Breaks review context and unexpectedly moves focus | Rejected |
| Add a new notification feed | Retains history | Adds redundant UI and does not improve the immediate decision | Rejected |

## Final stack

- Existing automatic-handoff projection:
  `src/client/lib/music-queue-release-transition-presentation.js`
- New selection-feedback projection:
  `src/client/lib/music-queue-match-selection-feedback-presentation.js`
- Existing release-scoped action-feedback and polite status region
- Client and browser assertions for the status copy and retained focus

## Security boundary

This is a presentation-only change. It does not alter the authenticated,
fresh-session, CSRF-protected, idempotent selection mutation, start an
additional provider request, expose provider identity or paths, or infer a
transfer acceptance from client state.
